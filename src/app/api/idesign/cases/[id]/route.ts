import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import {
  adminUsers,
  idesignCaseActivities,
  idesignCases,
  idesignOrders,
  idesignTreatmentCourses,
  idesignTreatmentPlans,
  idesignTreatmentSteps,
} from '@/lib/db/schema'
import { canManageIDesignPlans, canManageIDesignSchedule, canViewIDesign } from '@/lib/idesign/access'
import { IDESIGN_PROGRESS_OPTIONS } from '@/lib/idesign/orders'
import { getAccessibleIDesignCase, recordIDesignActivity, sessionActor } from '@/lib/idesign/workflow'

const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
const updateCaseSchema = z.union([
  z.object({ latestProgress: z.enum(IDESIGN_PROGRESS_OPTIONS) }),
  z.object({ updateTime: dateValue }),
])

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canViewIDesign(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const caseId = Number(params.id)
  if (!Number.isInteger(caseId)) return NextResponse.json({ error: 'Invalid case' }, { status: 400 })

  const userId = Number(session!.user.id)
  const caseRow = await getAccessibleIDesignCase(caseId, userId, session!.user.role)
  if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

  const db = getDb()
  const [plans, activities, courseRows, importedRows] = await Promise.all([
    db.select().from(idesignTreatmentPlans).where(eq(idesignTreatmentPlans.caseId, caseId)).orderBy(desc(idesignTreatmentPlans.versionNumber)),
    db.select().from(idesignCaseActivities).where(eq(idesignCaseActivities.caseId, caseId)).orderBy(desc(idesignCaseActivities.createdAt), desc(idesignCaseActivities.id)).limit(100),
    db.select().from(idesignTreatmentCourses).where(eq(idesignTreatmentCourses.caseId, caseId)).limit(1),
    caseRow.importedOrderId ? db.select().from(idesignOrders).where(eq(idesignOrders.id, caseRow.importedOrderId)).limit(1) : Promise.resolve([]),
  ])
  const course = courseRows[0] ?? null
  const steps = course
    ? await db.select().from(idesignTreatmentSteps).where(eq(idesignTreatmentSteps.courseId, course.id)).orderBy(asc(idesignTreatmentSteps.stepNumber))
    : []
  const accountIds = [...new Set([
    caseRow.createdBy,
    caseRow.doctorAccountId,
    caseRow.salesAccountId,
    ...plans.flatMap((plan) => [plan.createdBy, plan.approvedBy]),
  ].filter((id): id is number => Boolean(id)))]
  const accounts = accountIds.length
    ? await db.select({ id: adminUsers.id, name: adminUsers.fullName, username: adminUsers.username }).from(adminUsers).where(inArray(adminUsers.id, accountIds))
    : []
  const accountNames = new Map(accounts.map((account) => [account.id, account.name || account.username]))
  const imported = importedRows[0] ?? null
  const canSeeCommercial = session!.user.role === 'superadmin' || session!.user.role === 'sales'

  return NextResponse.json({
    case: {
      ...caseRow,
      doctorName: caseRow.doctorAccountId ? accountNames.get(caseRow.doctorAccountId) ?? null : imported?.doctorName ?? null,
      salesName: caseRow.salesAccountId ? accountNames.get(caseRow.salesAccountId) ?? null : imported?.salespersonName ?? null,
      createdByName: caseRow.createdBy ? accountNames.get(caseRow.createdBy) ?? null : null,
    },
    importedOrder: imported ? {
      category: imported.category,
      purchasedProducts: imported.purchasedProducts,
      totalSteps: imported.totalSteps,
      trackingNo: imported.trackingNo,
      deliveredDate: imported.deliveredDate,
      ...(canSeeCommercial ? {
        paymentStatus: imported.paymentStatus,
        originalCurrency: imported.originalCurrency,
        totalAmount: imported.totalAmount,
      } : {}),
    } : null,
    plans: plans.map((plan) => ({
      ...plan,
      createdByName: plan.createdBy ? accountNames.get(plan.createdBy) ?? null : null,
      approvedByName: plan.approvedBy ? accountNames.get(plan.approvedBy) ?? null : null,
    })),
    activities,
    course: course ? { ...course, steps } : null,
    permissions: {
      canManagePlans: session!.user.role === 'superadmin' || session!.user.role === 'admin',
      canApprovePlans: session!.user.role === 'doctor' || session!.user.role === 'clinic_staff',
      canManageSchedule: canManageIDesignSchedule(session!.user.role),
      canViewEditablePlan: ['superadmin', 'admin', 'sales', 'doctor', 'clinic_staff'].includes(session!.user.role),
      canViewCommercial: canSeeCommercial,
    },
  })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageIDesignPlans(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const caseId = Number(params.id)
  if (!Number.isInteger(caseId)) return NextResponse.json({ error: 'Invalid case' }, { status: 400 })
  const caseRow = await getAccessibleIDesignCase(caseId, Number(session!.user.id), session!.user.role)
  if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

  const parsed = updateCaseSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Select a valid status or update date' }, { status: 400 })

  if ('updateTime' in parsed.data) {
    const manualTime = new Date(`${parsed.data.updateTime}T00:00:00Z`)
    const db = getDb()
    await db.update(idesignCases).set({ updatedAt: manualTime }).where(eq(idesignCases.id, caseId))
    if (caseRow.importedOrderId) {
      await db.update(idesignOrders).set({ sourceUpdatedOn: parsed.data.updateTime, updatedAt: manualTime }).where(eq(idesignOrders.id, caseRow.importedOrderId))
    }
    await recordIDesignActivity({
      caseId,
      eventType: 'update_time_changed',
      detail: `Update time manually changed to ${parsed.data.updateTime}`,
      ...sessionActor(session!),
    })
    return NextResponse.json({ success: true })
  }

  const now = new Date()
  await getDb().update(idesignCases).set({ latestProgress: parsed.data.latestProgress, updatedAt: now }).where(eq(idesignCases.id, caseId))
  if (caseRow.importedOrderId) {
    await getDb().update(idesignOrders).set({ latestProgress: parsed.data.latestProgress, sourceUpdatedOn: now.toISOString().slice(0, 10), updatedAt: now }).where(eq(idesignOrders.id, caseRow.importedOrderId))
  }
  await recordIDesignActivity({
    caseId,
    eventType: 'status_changed',
    detail: `Status changed from ${caseRow.latestProgress} to ${parsed.data.latestProgress}`,
    ...sessionActor(session!),
  })
  return NextResponse.json({ success: true })
}
