import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { adminUsers, idesignCases, idesignOrders, idesignTreatmentCourses, idesignTreatmentPlans, idesignTreatmentSteps } from '@/lib/db/schema'
import { canApproveIDesignPlans, canAssignIDesignOrders, canCreateIDesignCases, canManageIDesignSchedule, canViewIDesign, getIDesignCaseAccessCondition } from '@/lib/idesign/access'
import { createIDesignCaseOrderNo, createIDesignCaseSchema, IDESIGN_SUBMITTED_PROGRESS } from '@/lib/idesign/cases'
import { getOrderOwnerId } from '@/lib/portal/access'
import { calculateAutomaticTreatmentProgress, dateInTimezone } from '@/lib/idesign/schedule'
import { persistIDesignSubmission, recordIDesignActivity, sessionActor } from '@/lib/idesign/workflow'

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
  const canAssignOrders = canAssignIDesignOrders(session!.user.role)
  const effectiveUpdateTime = sql<Date>`coalesce(
    (select ${idesignOrders.sourceUpdatedOn}::timestamptz from ${idesignOrders} where ${idesignOrders.id} = ${idesignCases.importedOrderId}),
    ${idesignCases.updatedAt}
  )`
  const [rows, totalRows, assignableAccounts] = await Promise.all([
    db.select().from(idesignCases).where(where).orderBy(desc(effectiveUpdateTime), desc(idesignCases.id)).limit(limit).offset((page - 1) * limit),
    db.select({ count: count() }).from(idesignCases).where(where),
    canAssignOrders
      ? db.select({ id: adminUsers.id, name: adminUsers.fullName, username: adminUsers.username, role: adminUsers.role })
        .from(adminUsers)
        .where(and(inArray(adminUsers.role, ['doctor', 'sales']), eq(adminUsers.isActive, true)))
        .orderBy(asc(adminUsers.fullName), asc(adminUsers.username))
      : Promise.resolve([]),
  ])
  const accountIds = [...new Set(rows.flatMap((row) => [row.doctorAccountId, row.salesAccountId]).filter((id): id is number => Boolean(id)))]
  const accounts = accountIds.length
    ? await db.select({ id: adminUsers.id, name: adminUsers.fullName, username: adminUsers.username }).from(adminUsers).where(inArray(adminUsers.id, accountIds))
    : []
  const accountNames = new Map(accounts.map((account) => [account.id, account.name || account.username]))
  const caseIds = rows.map((row) => row.id)
  const importedOrderIds = rows.flatMap((row) => row.importedOrderId ? [row.importedOrderId] : [])
  const [plans, courses, importedOrders] = await Promise.all([
    caseIds.length
      ? db.select({ caseId: idesignTreatmentPlans.caseId, versionNumber: idesignTreatmentPlans.versionNumber, status: idesignTreatmentPlans.status }).from(idesignTreatmentPlans).where(inArray(idesignTreatmentPlans.caseId, caseIds)).orderBy(asc(idesignTreatmentPlans.versionNumber))
      : Promise.resolve([]),
    caseIds.length
      ? db.select({ id: idesignTreatmentCourses.id, caseId: idesignTreatmentCourses.caseId, status: idesignTreatmentCourses.status, currentStep: idesignTreatmentCourses.currentStep, totalSteps: idesignTreatmentCourses.totalSteps, timezone: idesignTreatmentCourses.timezone }).from(idesignTreatmentCourses).where(inArray(idesignTreatmentCourses.caseId, caseIds))
      : Promise.resolve([]),
    importedOrderIds.length
      ? db.select({ id: idesignOrders.id, doctorName: idesignOrders.doctorName, sourceUpdatedOn: idesignOrders.sourceUpdatedOn, totalSteps: idesignOrders.totalSteps }).from(idesignOrders).where(inArray(idesignOrders.id, importedOrderIds))
      : Promise.resolve([]),
  ])
  const courseIds = courses.map((course) => course.id)
  const treatmentStages = courseIds.length
    ? await db.select({ courseId: idesignTreatmentSteps.courseId, stepNumber: idesignTreatmentSteps.stepNumber, suggestedStartDate: idesignTreatmentSteps.suggestedStartDate, suggestedEndDate: idesignTreatmentSteps.suggestedEndDate }).from(idesignTreatmentSteps).where(inArray(idesignTreatmentSteps.courseId, courseIds)).orderBy(asc(idesignTreatmentSteps.stepNumber))
    : []
  const currentPlans = new Map<number, { versionNumber: number; status: string }>()
  for (const plan of plans) currentPlans.set(plan.caseId, { versionNumber: plan.versionNumber, status: plan.status })
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
        doctorName: row.doctorAccountId ? accountNames.get(row.doctorAccountId) ?? importedOrder?.doctorName ?? null : importedOrder?.doctorName ?? null,
        assignedDoctorName: row.doctorAccountId ? accountNames.get(row.doctorAccountId) ?? null : null,
        assignedSalesName: row.salesAccountId ? accountNames.get(row.salesAccountId) ?? null : null,
        updateTime: importedOrder?.sourceUpdatedOn ?? row.updatedAt,
        currentPlanVersion: currentPlans.get(row.id)?.versionNumber ?? null,
        currentPlanStatus: currentPlans.get(row.id)?.status ?? null,
        importedTotalSteps: Number(importedOrder?.totalSteps) || null,
        course: coursesByCase.get(row.id) ?? null,
      }
    }),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    permissions: {
      canApprovePlans: canApproveIDesignPlans(session!.user.role),
      canAssignOrders,
      canCreateCases: canCreateIDesignCases(session!.user.role),
      canEditUpdateTime: session!.user.role === 'superadmin' || session!.user.role === 'admin',
      canManageSchedule: canManageIDesignSchedule(session!.user.role),
    },
    options: {
      assignableAccounts: assignableAccounts.map((account) => ({ id: account.id, name: account.name || account.username, role: account.role })),
    },
  })
}

export async function POST(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canCreateIDesignCases(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

  const db = getDb()
  try {
    const created = await persistIDesignSubmission({
      createCase: async () => {
        const [caseRow] = await db.insert(idesignCases).values({
          orderNo: createIDesignCaseOrderNo(),
          orderType: 'clear_aligner',
          ...parsed.data,
          latestProgress: IDESIGN_SUBMITTED_PROGRESS,
          createdBy: userId,
          doctorAccountId,
          salesAccountId: role === 'sales' ? userId : null,
        }).returning()
        return caseRow
      },
      recordActivity: (caseRow) => recordIDesignActivity({
        caseId: caseRow.id,
        eventType: 'case_submitted',
        detail: `Order submitted — status changed from Entering Info to ${IDESIGN_SUBMITTED_PROGRESS}`,
        ...sessionActor(session!),
      }),
      rollbackCase: async (caseRow) => {
        await db.delete(idesignCases).where(eq(idesignCases.id, caseRow.id))
      },
    })
    return NextResponse.json({ case: created }, { status: 201 })
  } catch (activityError) {
    console.error('Unable to record iDesign submission activity', activityError)
    return NextResponse.json({ error: 'The order could not be submitted. Please try again.' }, { status: 500 })
  }
}
