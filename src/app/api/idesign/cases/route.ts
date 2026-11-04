import { and, asc, count, desc, ilike, inArray, or, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { adminUsers, idesignCases, idesignOrders, idesignTreatmentCourses, idesignTreatmentPlans, idesignTreatmentSteps } from '@/lib/db/schema'
import { canViewIDesign, getIDesignCaseAccessCondition } from '@/lib/idesign/access'
import { createIDesignCaseOrderNo, createIDesignCaseSchema } from '@/lib/idesign/cases'
import { getOrderOwnerId } from '@/lib/portal/access'
import { calculateAutomaticTreatmentProgress, dateInTimezone } from '@/lib/idesign/schedule'

export async function GET(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canViewIDesign(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))
  const search = searchParams.get('search')?.trim()
  const conditions = []
  const accessCondition = await getIDesignCaseAccessCondition(Number(session!.user.id), session!.user.role)
  if (accessCondition) conditions.push(accessCondition)
  if (search) {
    const pattern = `%${search}%`
    conditions.push(or(ilike(idesignCases.orderNo, pattern), ilike(idesignCases.patientName, pattern))!)
  }
  const where = conditions.length ? and(...conditions) : undefined
  const db = getDb()
  const effectiveUpdateTime = sql<Date>`coalesce(
    (select ${idesignOrders.sourceUpdatedOn}::timestamptz from ${idesignOrders} where ${idesignOrders.id} = ${idesignCases.importedOrderId}),
    ${idesignCases.updatedAt}
  )`
  const [rows, totalRows] = await Promise.all([
    db.select().from(idesignCases).where(where).orderBy(desc(effectiveUpdateTime), desc(idesignCases.id)).limit(limit).offset((page - 1) * limit),
    db.select({ count: count() }).from(idesignCases).where(where),
  ])
  const accountIds = [...new Set(rows.map((row) => row.doctorAccountId).filter((id): id is number => Boolean(id)))]
  const accounts = accountIds.length
    ? await db.select({ id: adminUsers.id, name: adminUsers.fullName, username: adminUsers.username }).from(adminUsers).where(inArray(adminUsers.id, accountIds))
    : []
  const accountNames = new Map(accounts.map((account) => [account.id, account.name || account.username]))
  const caseIds = rows.map((row) => row.id)
  const importedOrderIds = rows.flatMap((row) => row.importedOrderId ? [row.importedOrderId] : [])
  const [plans, courses, importedOrders] = await Promise.all([
    caseIds.length
      ? db.select({ caseId: idesignTreatmentPlans.caseId, versionNumber: idesignTreatmentPlans.versionNumber }).from(idesignTreatmentPlans).where(inArray(idesignTreatmentPlans.caseId, caseIds)).orderBy(asc(idesignTreatmentPlans.versionNumber))
      : Promise.resolve([]),
    caseIds.length
      ? db.select({ id: idesignTreatmentCourses.id, caseId: idesignTreatmentCourses.caseId, status: idesignTreatmentCourses.status, currentStep: idesignTreatmentCourses.currentStep, totalSteps: idesignTreatmentCourses.totalSteps, timezone: idesignTreatmentCourses.timezone }).from(idesignTreatmentCourses).where(inArray(idesignTreatmentCourses.caseId, caseIds))
      : Promise.resolve([]),
    importedOrderIds.length
      ? db.select({ id: idesignOrders.id, doctorName: idesignOrders.doctorName, sourceUpdatedOn: idesignOrders.sourceUpdatedOn }).from(idesignOrders).where(inArray(idesignOrders.id, importedOrderIds))
      : Promise.resolve([]),
  ])
  const courseIds = courses.map((course) => course.id)
  const treatmentStages = courseIds.length
    ? await db.select({ courseId: idesignTreatmentSteps.courseId, stepNumber: idesignTreatmentSteps.stepNumber, suggestedStartDate: idesignTreatmentSteps.suggestedStartDate, suggestedEndDate: idesignTreatmentSteps.suggestedEndDate }).from(idesignTreatmentSteps).where(inArray(idesignTreatmentSteps.courseId, courseIds)).orderBy(asc(idesignTreatmentSteps.stepNumber))
    : []
  const currentVersions = new Map<number, number>()
  for (const plan of plans) currentVersions.set(plan.caseId, plan.versionNumber)
  const stagesByCourse = new Map<number, typeof treatmentStages>()
  for (const stage of treatmentStages) {
    const stages = stagesByCourse.get(stage.courseId) ?? []
    stages.push(stage)
    stagesByCourse.set(stage.courseId, stages)
  }
  const coursesByCase = new Map(courses.map((course) => {
    const automaticProgress = course.status === 'active'
      ? calculateAutomaticTreatmentProgress(stagesByCourse.get(course.id) ?? [], dateInTimezone(new Date(), course.timezone))
      : null
    return [course.caseId, {
      ...course,
      currentStep: automaticProgress?.currentStage ?? course.currentStep,
      status: automaticProgress?.status ?? course.status,
    }]
  }))
  const importedOrdersById = new Map(importedOrders.map((order) => [order.id, order]))
  const total = totalRows[0]?.count ?? 0

  return NextResponse.json({
    cases: rows.map((row) => {
      const importedOrder = row.importedOrderId ? importedOrdersById.get(row.importedOrderId) : null
      return {
        ...row,
        doctorName: importedOrder?.doctorName ?? (row.doctorAccountId ? accountNames.get(row.doctorAccountId) ?? null : null),
        updateTime: importedOrder?.sourceUpdatedOn ?? row.updatedAt,
        currentPlanVersion: currentVersions.get(row.id) ?? null,
        course: coursesByCase.get(row.id) ?? null,
      }
    }),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    permissions: { canEditUpdateTime: session!.user.role === 'superadmin' || session!.user.role === 'admin' },
  })
}

export async function POST(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canViewIDesign(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = createIDesignCaseSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the highlighted fields', details: parsed.error.flatten() }, { status: 400 })
  }

  const userId = Number(session!.user.id)
  const role = session!.user.role
  const doctorAccountId = role === 'doctor' || role === 'clinic_staff' ? await getOrderOwnerId(userId, role) : null
  if ((role === 'doctor' || role === 'clinic_staff') && !doctorAccountId) {
    return NextResponse.json({ error: 'This account is not linked to a doctor profile' }, { status: 403 })
  }

  const [created] = await getDb().insert(idesignCases).values({
    orderNo: createIDesignCaseOrderNo(),
    orderType: 'clear_aligner',
    ...parsed.data,
    createdBy: userId,
    doctorAccountId,
    salesAccountId: role === 'sales' ? userId : null,
  }).returning()

  return NextResponse.json({ case: created }, { status: 201 })
}
