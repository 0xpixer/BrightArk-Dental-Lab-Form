import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { isSalesRole } from '@/lib/admin/roles'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import {
  adminUsers,
  doctorClinics,
  idesignCaseActivities,
  idesignCases,
  idesignOrders,
  idesignTreatmentCourses,
  idesignTreatmentPlans,
  idesignTreatmentSteps,
} from '@/lib/db/schema'
import { canAssignIDesignOrders, canDeleteIDesignOrders, canDownloadIDesignCaseFiles, canEditIDesignCaseInformation, canManageIDesignPlans, canManageIDesignSchedule, canPublishIDesignPlans, canViewIDesign } from '@/lib/idesign/access'
import { IDESIGN_PROGRESS_OPTIONS } from '@/lib/idesign/orders'
import { updateIDesignCaseInformationSchema } from '@/lib/idesign/cases'
import { calculateAutomaticTreatmentProgress, dateInTimezone } from '@/lib/idesign/schedule'
import { getAccessibleIDesignCase, recordIDesignActivity, sessionActor } from '@/lib/idesign/workflow'

const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
const updateCaseSchema = z.union([
  z.object({ latestProgress: z.enum(IDESIGN_PROGRESS_OPTIONS) }),
  z.object({ updateTime: dateValue }),
  z.object({ action: z.literal('update_case_information'), data: updateIDesignCaseInformationSchema }),
  z.object({
    action: z.literal('assign_owners'),
    doctorAccountId: z.number().int().positive().nullable(),
    salesAccountId: z.number().int().positive().nullable(),
  }),
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
  const automaticProgress = course?.status === 'active'
    ? calculateAutomaticTreatmentProgress(steps, dateInTimezone(new Date(), course.timezone))
    : null
  const accountIds = [...new Set([
    caseRow.createdBy,
    caseRow.doctorAccountId,
    caseRow.salesAccountId,
    ...plans.flatMap((plan) => [plan.createdBy, plan.approvedBy]),
  ].filter((id): id is number => Boolean(id)))]
  const [accounts, doctorClinicRows] = await Promise.all([
    accountIds.length
      ? db.select({ id: adminUsers.id, name: adminUsers.fullName, username: adminUsers.username, clinicName: adminUsers.clinicName }).from(adminUsers).where(inArray(adminUsers.id, accountIds))
      : Promise.resolve([]),
    caseRow.doctorAccountId
      ? db.select({ name: doctorClinics.name }).from(doctorClinics).where(eq(doctorClinics.doctorId, caseRow.doctorAccountId)).orderBy(asc(doctorClinics.id)).limit(1)
      : Promise.resolve([]),
  ])
  const accountNames = new Map(accounts.map((account) => [account.id, account.name || account.username]))
  const assignedDoctor = caseRow.doctorAccountId ? accounts.find((account) => account.id === caseRow.doctorAccountId) : null
  const clinicName = assignedDoctor?.clinicName || doctorClinicRows[0]?.name || null
  const imported = importedRows[0] ?? null
  const canSeeCommercial = session!.user.role === 'superadmin' || isSalesRole(session!.user.role)

  return NextResponse.json({
    case: {
      ...caseRow,
      doctorName: caseRow.doctorAccountId ? accountNames.get(caseRow.doctorAccountId) ?? null : imported?.doctorName ?? null,
      clinicName,
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
    course: course ? {
      ...course,
      currentStep: automaticProgress?.currentStage ?? course.currentStep,
      nextSuggestedChange: automaticProgress ? automaticProgress.nextSuggestedChange : course.nextSuggestedChange,
      status: automaticProgress?.status ?? course.status,
      steps: automaticProgress
        ? steps.map((step) => ({ ...step, status: automaticProgress.stageStatuses.get(step.stepNumber) ?? step.status }))
        : steps,
    } : null,
    permissions: {
      canManagePlans: canPublishIDesignPlans(session!.user.role),
      canUpdateStatus: canManageIDesignPlans(session!.user.role),
      canApprovePlans: session!.user.role === 'doctor' || session!.user.role === 'clinic_staff',
      canManageSchedule: canManageIDesignSchedule(session!.user.role),
      canViewEditablePlan: ['superadmin', 'admin', 'sales', 'sales_director', 'doctor', 'clinic_staff', 'treatment_designer'].includes(session!.user.role),
      canViewCommercial: canSeeCommercial,
      canEditCaseInformation: canEditIDesignCaseInformation(session!.user.role),
      canDownloadCaseFiles: canDownloadIDesignCaseFiles(session!.user.role),
      canDeleteCase: canDeleteIDesignOrders(session!.user.role),
      showSales: session!.user.role !== 'doctor' && session!.user.role !== 'clinic_staff',
    },
  })
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canDeleteIDesignOrders(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const caseId = Number(params.id)
  if (!Number.isInteger(caseId) || caseId <= 0) return NextResponse.json({ error: 'Invalid case' }, { status: 400 })

  try {
    const db = getDb()
    const [caseRow] = await db.select({ id: idesignCases.id, importedOrderId: idesignCases.importedOrderId }).from(idesignCases).where(eq(idesignCases.id, caseId)).limit(1)
    if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

    if (caseRow.importedOrderId) {
      await db.delete(idesignOrders).where(eq(idesignOrders.id, caseRow.importedOrderId))
    } else {
      await db.delete(idesignCases).where(eq(idesignCases.id, caseId))
    }
    return NextResponse.json({ success: true })
  } catch (deleteError) {
    console.error('iDesign case delete failed:', deleteError)
    return NextResponse.json({ error: 'Unable to delete this order' }, { status: 500 })
  }
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
  if (!parsed.success) return NextResponse.json({ error: 'Please check the case information and try again', details: parsed.error.flatten() }, { status: 400 })

  if ('action' in parsed.data && parsed.data.action === 'assign_owners') {
    if (!canAssignIDesignOrders(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const db = getDb()
    const accountIds = [parsed.data.doctorAccountId, parsed.data.salesAccountId].filter((id): id is number => id !== null)
    const accounts = accountIds.length
      ? await db.select({ id: adminUsers.id, role: adminUsers.role, name: adminUsers.fullName, username: adminUsers.username })
        .from(adminUsers)
        .where(and(inArray(adminUsers.id, accountIds), eq(adminUsers.isActive, true)))
      : []
    const accountsById = new Map(accounts.map((account) => [account.id, account]))
    const doctor = parsed.data.doctorAccountId ? accountsById.get(parsed.data.doctorAccountId) : null
    const sales = parsed.data.salesAccountId ? accountsById.get(parsed.data.salesAccountId) : null
    if (parsed.data.doctorAccountId && doctor?.role !== 'doctor') {
      return NextResponse.json({ error: 'Choose an active Doctor account' }, { status: 400 })
    }
    if (parsed.data.salesAccountId && !isSalesRole(sales?.role)) {
      return NextResponse.json({ error: 'Choose an active Sales account' }, { status: 400 })
    }

    await db.update(idesignCases).set({
      doctorAccountId: parsed.data.doctorAccountId,
      salesAccountId: parsed.data.salesAccountId,
    }).where(eq(idesignCases.id, caseId))
    if (caseRow.importedOrderId) {
      await db.update(idesignOrders).set({
        doctorAccountId: parsed.data.doctorAccountId,
        salesAccountId: parsed.data.salesAccountId,
        assignmentUpdatedBy: Number(session!.user.id),
        assignmentUpdatedAt: new Date(),
      }).where(eq(idesignOrders.id, caseRow.importedOrderId))
    }
    const doctorName = doctor ? doctor.name || doctor.username : 'Unassigned'
    const salesName = sales ? sales.name || sales.username : 'Unassigned'
    await recordIDesignActivity({
      caseId,
      eventType: 'owners_assigned',
      detail: `Order access updated — Doctor: ${doctorName}; Sales: ${salesName}`,
      ...sessionActor(session!),
    })
    return NextResponse.json({ success: true })
  }

  if ('action' in parsed.data && parsed.data.action === 'update_case_information') {
    if (!canEditIDesignCaseInformation(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const now = new Date()
    const db = getDb()
    await db.update(idesignCases).set({ ...parsed.data.data, updatedAt: now }).where(eq(idesignCases.id, caseId))
    if (caseRow.importedOrderId) {
      await db.update(idesignOrders).set({
        patientName: parsed.data.data.patientName,
        sourceUpdatedOn: now.toISOString().slice(0, 10),
        updatedAt: now,
      }).where(eq(idesignOrders.id, caseRow.importedOrderId))
    }
    await recordIDesignActivity({
      caseId,
      eventType: 'case_information_updated',
      detail: 'Case information and clinical records updated',
      ...sessionActor(session!),
    })
    return NextResponse.json({ success: true })
  }

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

  if (!('latestProgress' in parsed.data)) return NextResponse.json({ error: 'Invalid case update' }, { status: 400 })
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
