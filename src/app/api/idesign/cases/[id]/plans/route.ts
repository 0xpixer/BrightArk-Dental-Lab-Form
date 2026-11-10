import { and, desc, eq, max } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { idesignCases, idesignOrders, idesignTreatmentPlans } from '@/lib/db/schema'
import { canApproveIDesignPlans, canPublishIDesignPlans, canViewIDesign } from '@/lib/idesign/access'
import { notifyIDesignCase } from '@/lib/idesign/notifications'
import { getAccessibleIDesignCase, recordIDesignActivity, sessionActor } from '@/lib/idesign/workflow'
import { queueAlignerLarkNotification } from '@/lib/idesign/larkAligner'
import { getIDesignPlanApprovalState } from '@/lib/idesign/approval'

const httpsUrl = z.string().trim().url().refine((value) => value.startsWith('https://'), 'Use an HTTPS link')
const publishSchema = z.object({
  editableUrl: httpsUrl,
  summary: z.string().trim().max(500).optional(),
})
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), planId: z.number().int().positive() }),
  z.object({ action: z.literal('review_complete') }),
  z.object({ action: z.literal('update_editable'), editableUrl: httpsUrl }),
])

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canPublishIDesignPlans(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const caseId = Number(params.id)
  const caseRow = await getAccessibleIDesignCase(caseId, Number(session!.user.id), session!.user.role)
  if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  const parsed = publishSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the plan links' }, { status: 400 })

  const db = getDb()
  const [versionRow] = await db.select({ value: max(idesignTreatmentPlans.versionNumber) }).from(idesignTreatmentPlans).where(eq(idesignTreatmentPlans.caseId, caseId))
  const versionNumber = (versionRow?.value ?? 0) + 1
  const now = new Date()
  await db.update(idesignTreatmentPlans).set({ status: 'superseded', updatedAt: now }).where(and(
    eq(idesignTreatmentPlans.caseId, caseId),
    eq(idesignTreatmentPlans.status, 'published'),
  ))
  const [plan] = await db.insert(idesignTreatmentPlans).values({
    caseId,
    versionNumber,
    summary: parsed.data.summary || null,
    editableUrl: parsed.data.editableUrl,
    createdBy: Number(session!.user.id),
    publishedAt: now,
  }).returning()
  await db.update(idesignCases).set({
    currentEditableUrl: parsed.data.editableUrl,
    planReviewStatus: 'awaiting_review',
    latestProgress: 'Awaiting Approval',
    updatedAt: now,
  }).where(eq(idesignCases.id, caseId))
  if (caseRow.importedOrderId) await db.update(idesignOrders).set({ latestProgress: 'Awaiting Approval', sourceUpdatedOn: now.toISOString().slice(0, 10), updatedAt: now }).where(eq(idesignOrders.id, caseRow.importedOrderId))

  await recordIDesignActivity({ caseId, eventType: 'plan_published', detail: `V${versionNumber} published`, ...sessionActor(session!) })
  await notifyIDesignCase(caseRow, {
    type: 'plan_published',
    title: `Treatment plan V${versionNumber} is ready`,
    body: `A new treatment plan is ready for ${caseRow.patientName}.`,
    dedupeKey: `plan-published-${plan.id}`,
    audience: 'clinical_and_sales',
  })
  return NextResponse.json({ plan }, { status: 201 })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canViewIDesign(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const caseId = Number(params.id)
  const caseRow = await getAccessibleIDesignCase(caseId, Number(session!.user.id), session!.user.role)
  if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid plan action' }, { status: 400 })

  if (parsed.data.action === 'update_editable') {
    if (!canPublishIDesignPlans(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const db = getDb()
    const [latestPlan] = await db.select({ id: idesignTreatmentPlans.id }).from(idesignTreatmentPlans).where(eq(idesignTreatmentPlans.caseId, caseId)).orderBy(desc(idesignTreatmentPlans.versionNumber)).limit(1)
    await db.update(idesignCases).set({ currentEditableUrl: parsed.data.editableUrl, updatedAt: new Date() }).where(eq(idesignCases.id, caseId))
    if (latestPlan) await db.update(idesignTreatmentPlans).set({ editableUrl: parsed.data.editableUrl, updatedAt: new Date() }).where(eq(idesignTreatmentPlans.id, latestPlan.id))
    await recordIDesignActivity({ caseId, eventType: 'editable_link', detail: 'Current editable treatment plan link updated', ...sessionActor(session!) })
    return NextResponse.json({ success: true })
  }

  if (!canApproveIDesignPlans(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const db = getDb()
  const now = new Date()

  if (parsed.data.action === 'approve') {
    const [selectedPlanRows, approvedPlanRows] = await Promise.all([
      db.select().from(idesignTreatmentPlans).where(and(eq(idesignTreatmentPlans.id, parsed.data.planId), eq(idesignTreatmentPlans.caseId, caseId))).limit(1),
      db.select().from(idesignTreatmentPlans).where(and(eq(idesignTreatmentPlans.caseId, caseId), eq(idesignTreatmentPlans.status, 'approved'))).limit(1),
    ])
    const selectedPlan = selectedPlanRows[0]
    const existingApprovedPlan = approvedPlanRows[0]
    if (!selectedPlan) return NextResponse.json({ error: 'Treatment plan version not found' }, { status: 404 })
    if (existingApprovedPlan) return NextResponse.json({ success: true, alreadyApproved: true, approvedPlanId: existingApprovedPlan.id })
    const approvalState = getIDesignPlanApprovalState(caseRow.latestProgress, selectedPlan.status)
    if (!approvalState.readyForApproval) return NextResponse.json({ error: 'This treatment plan is not ready for approval' }, { status: 409 })
    await db.update(idesignTreatmentPlans).set({ status: 'superseded', updatedAt: now }).where(eq(idesignTreatmentPlans.caseId, caseId))
    await db.update(idesignTreatmentPlans).set({ status: 'approved', approvedBy: Number(session!.user.id), approvedAt: now, updatedAt: now }).where(eq(idesignTreatmentPlans.id, selectedPlan.id))
    await db.update(idesignCases).set({ planReviewStatus: 'approved', latestProgress: 'Approved', updatedAt: now }).where(eq(idesignCases.id, caseId))
    if (caseRow.importedOrderId) await db.update(idesignOrders).set({ latestProgress: 'Approved', sourceUpdatedOn: now.toISOString().slice(0, 10), updatedAt: now }).where(eq(idesignOrders.id, caseRow.importedOrderId))
    await recordIDesignActivity({ caseId, eventType: 'plan_approved', detail: `V${selectedPlan.versionNumber} approved`, ...sessionActor(session!) })
    await notifyIDesignCase(caseRow, { type: 'plan_approved', title: 'Treatment plan approved', body: `${caseRow.patientName}'s treatment plan V${selectedPlan.versionNumber} was approved.`, dedupeKey: `plan-approved-${selectedPlan.id}`, audience: 'lab' })
    queueAlignerLarkNotification('approved', caseRow, request, { planVersion: selectedPlan.versionNumber })
  } else {
    const [latestPlan] = await db.select().from(idesignTreatmentPlans).where(eq(idesignTreatmentPlans.caseId, caseId)).orderBy(desc(idesignTreatmentPlans.versionNumber)).limit(1)
    if (!latestPlan) return NextResponse.json({ error: 'No treatment plan has been published' }, { status: 400 })
    await getDb().update(idesignTreatmentPlans).set({ status: 'review_completed', updatedAt: now }).where(eq(idesignTreatmentPlans.id, latestPlan.id))
    await getDb().update(idesignCases).set({ planReviewStatus: 'review_completed', updatedAt: now }).where(eq(idesignCases.id, caseId))
    await recordIDesignActivity({ caseId, eventType: 'review_completed', detail: `Review completed for V${latestPlan.versionNumber}`, ...sessionActor(session!) })
    await notifyIDesignCase(caseRow, { type: 'review_completed', title: 'Treatment plan review completed', body: `${caseRow.patientName}'s treatment plan review is ready for lab follow-up.`, dedupeKey: `review-completed-${latestPlan.id}`, audience: 'lab' })
  }
  return NextResponse.json({ success: true })
}
