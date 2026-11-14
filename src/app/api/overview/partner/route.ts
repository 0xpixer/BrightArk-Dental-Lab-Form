import { NextResponse } from 'next/server'
import { and, asc, desc, eq, inArray, type SQL } from 'drizzle-orm'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { adminUsers, idesignCaseActivities, idesignCases, idesignOrders, idesignTreatmentCourses, idesignTreatmentSteps, orderDrafts, orders } from '@/lib/db/schema'
import { isPortalRole, isSalesRole } from '@/lib/admin/roles'
import { getIDesignCaseAccessCondition } from '@/lib/idesign/access'
import { dateInTimezone } from '@/lib/idesign/schedule'
import { getFinanceOverdueDays, getFinanceScope } from '@/lib/finance/server'
import { getDoctorProfile, getOrderOwnerId } from '@/lib/portal/access'
import { getSalesDoctors, getSalesOrderAccessCondition } from '@/lib/sales/access'
import { doctorOrderScope } from '@/lib/portal/orderScope'
import { buildOverviewMetrics } from '@/lib/overviewMetrics'
import { latestOrderMessageAt, unreadLatestOrderMessageCondition } from '@/lib/orderUnread'
import {
  buildAlignerOverview,
  buildDoctorSummaries,
  buildFinanceSummary,
  buildLabExtras,
  type PartnerAlignerCaseInput,
  type PartnerLabOrderInput,
} from '@/lib/overview/partner'

/** Doctor / clinic staff / sales overview. Everything is scoped to the caller's own orders. */
export async function GET(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  const role = session!.user.role
  if (!isPortalRole(role) && !isSalesRole(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const userId = Number(session!.user.id)
  const { searchParams } = new URL(request.url)
  const tab = searchParams.get('tab') === 'lab' ? 'lab' : 'aligners'
  const db = getDb()

  // Resolve the doctor scope: a portal user sees one doctor; sales may narrow to one assigned doctor.
  let doctors: Array<{ id: number; name: string }> = []
  let doctorId: number | null = null
  let ownerId: number | null = null
  if (isPortalRole(role)) {
    ownerId = await getOrderOwnerId(userId, role)
    if (!ownerId) return NextResponse.json({ error: 'Clinic staff is not linked to a doctor' }, { status: 403 })
    doctorId = ownerId
  } else {
    doctors = (await getSalesDoctors(userId))
      .map((doctor) => ({ id: doctor.id, name: doctor.fullName || doctor.email || 'Doctor' }))
      .sort((left, right) => left.name.localeCompare(right.name))
    const requested = Number(searchParams.get('doctorId'))
    if (Number.isInteger(requested) && requested > 0) {
      if (!doctors.some((doctor) => doctor.id === requested)) return NextResponse.json({ error: 'Selected doctor is unavailable' }, { status: 400 })
      doctorId = requested
    }
  }

  const profile = ownerId ? await getDoctorProfile(ownerId) : null
  const today = new Date().toISOString().slice(0, 10)

  // Finance reminder is shown on both tabs.
  const [financeScope, overdueDays] = await Promise.all([getFinanceScope(userId, role), getFinanceOverdueDays()])
  const financeConditions: SQL[] = []
  if (financeScope) financeConditions.push(financeScope)
  if (doctorId && isSalesRole(role)) financeConditions.push(eq(idesignOrders.doctorAccountId, doctorId))
  const financeRows = await db.select({
    paymentStatus: idesignOrders.paymentStatus,
    dueDate: idesignOrders.dueDate,
    invoiceDate: idesignOrders.invoiceDate,
    originalPrice: idesignOrders.originalPrice,
    discount: idesignOrders.discount,
    totalAmount: idesignOrders.totalAmount,
    currency: idesignOrders.originalCurrency,
  }).from(idesignOrders).where(and(eq(idesignOrders.paymentStatus, 'Unpaid'), ...financeConditions))
  const finance = { ...buildFinanceSummary(financeRows, overdueDays, today), overdueDays }

  const base = {
    tab,
    role: isPortalRole(role) ? 'portal' as const : 'sales' as const,
    doctorName: profile?.fullName ?? null,
    doctors,
    selectedDoctorId: isSalesRole(role) ? doctorId : null,
    finance,
    generatedAt: new Date().toISOString(),
  }

  // Aligner cases are needed for the aligner tab and for the sales "My doctors" table on either tab.
  const loadAlignerCases = async (): Promise<PartnerAlignerCaseInput[]> => {
    const conditions: SQL[] = []
    const access = await getIDesignCaseAccessCondition(userId, role)
    if (access) conditions.push(access)
    if (doctorId && isSalesRole(role)) conditions.push(eq(idesignCases.doctorAccountId, doctorId))
    const rows = await db.select({
      id: idesignCases.id,
      orderNo: idesignCases.orderNo,
      patientName: idesignCases.patientName,
      latestProgress: idesignCases.latestProgress,
      createdAt: idesignCases.createdAt,
      updatedAt: idesignCases.updatedAt,
      doctorAccountId: idesignCases.doctorAccountId,
      sourceCreatedOn: idesignOrders.sourceCreatedOn,
      sourceUpdatedOn: idesignOrders.sourceUpdatedOn,
      sourceDoctorName: idesignOrders.doctorName,
      doctorFullName: adminUsers.fullName,
      courseId: idesignTreatmentCourses.id,
    })
      .from(idesignCases)
      .leftJoin(idesignOrders, eq(idesignOrders.id, idesignCases.importedOrderId))
      .leftJoin(adminUsers, eq(adminUsers.id, idesignCases.doctorAccountId))
      .leftJoin(idesignTreatmentCourses, eq(idesignTreatmentCourses.caseId, idesignCases.id))
      .where(conditions.length ? and(...conditions) : undefined)
    return rows.map((row) => {
      const updated = row.updatedAt.toISOString()
      return {
        id: row.id,
        orderNo: row.orderNo,
        patientName: row.patientName,
        latestProgress: row.latestProgress,
        createdOn: row.sourceCreatedOn ?? row.createdAt.toISOString().slice(0, 10),
        // An imported case's spreadsheet update date is newer information than the row timestamp.
        updatedAt: row.sourceUpdatedOn && row.sourceUpdatedOn > updated.slice(0, 10) ? `${row.sourceUpdatedOn}T00:00:00.000Z` : updated,
        doctorAccountId: row.doctorAccountId,
        doctorName: row.doctorFullName ?? row.sourceDoctorName ?? null,
        hasCourse: row.courseId !== null,
      }
    })
  }

  const loadLabOrders = async (): Promise<{ rows: PartnerLabOrderInput[]; where: SQL | undefined }> => {
    let where: SQL | undefined
    if (isPortalRole(role)) where = doctorOrderScope([ownerId!])
    else {
      where = await getSalesOrderAccessCondition(userId)
      if (doctorId) where = and(where, doctorOrderScope([doctorId]))
    }
    const rows = await db.select({
      id: orders.id,
      orderNo: orders.orderNo,
      patientName: orders.patientName,
      status: orders.status,
      treatmentType: orders.treatmentType,
      createdAt: orders.createdAt,
      statusUpdatedAt: orders.statusUpdatedAt,
      submittedBy: orders.submittedBy,
    }).from(orders).where(where)
    return {
      where,
      rows: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), statusUpdatedAt: row.statusUpdatedAt.toISOString() })),
    }
  }

  if (tab === 'aligners') {
    const cases = await loadAlignerCases()
    const caseIds = cases.map((row) => row.id)
    const [courses, activities, lab] = await Promise.all([
      caseIds.length
        ? db.select({ id: idesignTreatmentCourses.id, caseId: idesignTreatmentCourses.caseId, totalSteps: idesignTreatmentCourses.totalSteps, status: idesignTreatmentCourses.status, timezone: idesignTreatmentCourses.timezone })
          .from(idesignTreatmentCourses).where(and(inArray(idesignTreatmentCourses.caseId, caseIds), eq(idesignTreatmentCourses.status, 'active')))
        : Promise.resolve([]),
      caseIds.length
        ? db.select({ id: idesignCaseActivities.id, caseId: idesignCaseActivities.caseId, eventType: idesignCaseActivities.eventType, detail: idesignCaseActivities.detail, actorName: idesignCaseActivities.actorName, createdAt: idesignCaseActivities.createdAt, patientName: idesignCases.patientName, orderNo: idesignCases.orderNo })
          .from(idesignCaseActivities)
          .innerJoin(idesignCases, eq(idesignCases.id, idesignCaseActivities.caseId))
          .where(inArray(idesignCaseActivities.caseId, caseIds))
          .orderBy(desc(idesignCaseActivities.createdAt))
          .limit(8)
        : Promise.resolve([]),
      isSalesRole(role) ? loadLabOrders() : Promise.resolve(null),
    ])
    const courseIds = courses.map((course) => course.id)
    const stages = courseIds.length
      ? await db.select({ courseId: idesignTreatmentSteps.courseId, stepNumber: idesignTreatmentSteps.stepNumber, suggestedStartDate: idesignTreatmentSteps.suggestedStartDate, suggestedEndDate: idesignTreatmentSteps.suggestedEndDate })
        .from(idesignTreatmentSteps).where(inArray(idesignTreatmentSteps.courseId, courseIds)).orderBy(asc(idesignTreatmentSteps.stepNumber))
      : []
    const courseInputs = courses.map((course) => ({
      caseId: course.caseId,
      totalSteps: course.totalSteps,
      status: course.status,
      today: dateInTimezone(new Date(), course.timezone),
      stages: stages.filter((stage) => stage.courseId === course.id),
    }))
    return NextResponse.json({
      ...base,
      aligners: buildAlignerOverview(cases, courseInputs),
      activity: activities.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      doctorSummaries: isSalesRole(role) && !doctorId ? buildDoctorSummaries(doctors, cases, lab?.rows ?? []) : [],
    })
  }

  const lab = await loadLabOrders()
  const latestMessageAt = latestOrderMessageAt()
  const [newMessages, drafts, cases] = await Promise.all([
    db.select({ orderId: orders.id, orderNo: orders.orderNo, patientName: orders.patientName, latestMessageAt })
      .from(orders)
      .where(and(lab.where, unreadLatestOrderMessageCondition(userId)))
      .orderBy(desc(latestMessageAt))
      .limit(8),
    isPortalRole(role)
      ? db.select({ id: orderDrafts.id, formData: orderDrafts.formData, updatedAt: orderDrafts.updatedAt }).from(orderDrafts).where(eq(orderDrafts.ownerId, ownerId!)).orderBy(desc(orderDrafts.updatedAt)).limit(5)
      : Promise.resolve([]),
    isSalesRole(role) && !doctorId ? loadAlignerCases() : Promise.resolve([]),
  ])

  return NextResponse.json({
    ...base,
    lab: {
      metrics: buildOverviewMetrics(lab.rows, 'month'),
      ...buildLabExtras(lab.rows),
      newMessages,
      drafts: drafts.map((draft) => {
        const values = (draft.formData ?? {}) as Record<string, unknown>
        const patient = typeof values.patient === 'string' && values.patient.trim() ? values.patient.trim() : 'Untitled draft'
        return { id: draft.id, patientName: patient, updatedAt: draft.updatedAt.toISOString() }
      }),
    },
    doctorSummaries: isSalesRole(role) && !doctorId ? buildDoctorSummaries(doctors, cases, lab.rows) : [],
  })
}
