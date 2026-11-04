import { and, asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { idesignCases, idesignOrders, idesignTreatmentCourses, idesignTreatmentSteps } from '@/lib/db/schema'
import { canManageIDesignSchedule } from '@/lib/idesign/access'
import {
  calculateEstimatedFinish,
  calculateAutomaticTreatmentProgress,
  calculateTreatmentSteps,
  dateInTimezone,
  recalculateRemainingSteps,
  startTreatmentCourseSchema,
  suggestedChangeDate,
  updateTreatmentDurationsSchema,
} from '@/lib/idesign/schedule'
import { getAccessibleIDesignCase, recordIDesignActivity, sessionActor } from '@/lib/idesign/workflow'

const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
const resetActionSchema = z.object({
  action: z.literal('reset'),
  startDate: dateValue,
  totalSteps: z.number().int().min(1).max(100),
  defaultDurationDays: z.number().int().min(1).max(60),
  durations: z.array(z.number().int().min(1).max(60)).min(1).max(100),
  timezone: z.string().trim().min(1).max(80),
}).superRefine((value, context) => {
  if (value.durations.length !== value.totalSteps) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['durations'], message: 'Add a duration for every stage' })
  }
})
const actionSchema = z.union([
  z.object({ action: z.literal('pause') }),
  z.object({ action: z.literal('resume'), actualDate: dateValue }),
  z.object({ action: z.literal('update_durations'), durations: updateTreatmentDurationsSchema.shape.durations }),
  resetActionSchema,
])

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const context = await scheduleContext(params.id)
  if ('response' in context) return context.response
  const parsed = startTreatmentCourseSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the schedule' }, { status: 400 })

  const db = getDb()
  const [existing] = await db.select({ id: idesignTreatmentCourses.id }).from(idesignTreatmentCourses).where(eq(idesignTreatmentCourses.caseId, context.caseRow.id)).limit(1)
  if (existing) return NextResponse.json({ error: 'A treatment schedule already exists' }, { status: 409 })
  const steps = calculateTreatmentSteps(parsed.data.startDate, parsed.data.durations)
  const estimatedFinish = calculateEstimatedFinish(parsed.data.startDate, parsed.data.durations)
  const automaticProgress = calculateAutomaticTreatmentProgress(steps, dateInTimezone(new Date(), parsed.data.timezone))!
  const [course] = await db.insert(idesignTreatmentCourses).values({
    caseId: context.caseRow.id,
    startDate: parsed.data.startDate,
    totalSteps: parsed.data.totalSteps,
    defaultDurationDays: parsed.data.defaultDurationDays,
    currentStep: automaticProgress.currentStage,
    originalEstimatedFinish: estimatedFinish,
    currentEstimatedFinish: estimatedFinish,
    nextSuggestedChange: automaticProgress.nextSuggestedChange,
    timezone: parsed.data.timezone,
    status: automaticProgress.status,
    createdBy: context.userId,
  }).returning()
  await db.insert(idesignTreatmentSteps).values(steps.map((step) => ({
    courseId: course.id,
    ...step,
    actualStartDate: step.stepNumber === 1 ? parsed.data.startDate : null,
    status: automaticProgress.stageStatuses.get(step.stepNumber) ?? 'scheduled',
  })))
  if (context.caseRow.importedOrderId) await db.update(idesignOrders).set({ totalSteps: String(parsed.data.totalSteps), updatedAt: new Date() }).where(eq(idesignOrders.id, context.caseRow.importedOrderId))
  await recordIDesignActivity({ caseId: context.caseRow.id, eventType: 'schedule_started', detail: `Wear schedule started with ${parsed.data.totalSteps} stages`, ...sessionActor(context.session) })
  return NextResponse.json({ success: true, course }, { status: 201 })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const context = await scheduleContext(params.id)
  if ('response' in context) return context.response
  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid schedule action' }, { status: 400 })

  const db = getDb()
  const [course] = await db.select().from(idesignTreatmentCourses).where(eq(idesignTreatmentCourses.caseId, context.caseRow.id)).limit(1)
  if (!course) return NextResponse.json({ error: 'Start the treatment schedule first' }, { status: 404 })
  const steps = await db.select().from(idesignTreatmentSteps).where(eq(idesignTreatmentSteps.courseId, course.id)).orderBy(asc(idesignTreatmentSteps.stepNumber))
  const now = new Date()

  if (parsed.data.action === 'reset') {
    const reset = parsed.data
    const recalculated = calculateTreatmentSteps(reset.startDate, reset.durations)
    const estimatedFinish = calculateEstimatedFinish(reset.startDate, reset.durations)
    const automaticProgress = calculateAutomaticTreatmentProgress(recalculated, dateInTimezone(now, reset.timezone))!
    await db.update(idesignTreatmentCourses).set({
      startDate: reset.startDate,
      totalSteps: reset.totalSteps,
      defaultDurationDays: reset.defaultDurationDays,
      currentStep: automaticProgress.currentStage,
      originalEstimatedFinish: estimatedFinish,
      currentEstimatedFinish: estimatedFinish,
      nextSuggestedChange: automaticProgress.nextSuggestedChange,
      timezone: reset.timezone,
      status: automaticProgress.status,
      updatedAt: now,
    }).where(eq(idesignTreatmentCourses.id, course.id))
    await db.delete(idesignTreatmentSteps).where(eq(idesignTreatmentSteps.courseId, course.id))
    await db.insert(idesignTreatmentSteps).values(recalculated.map((stage) => ({
      courseId: course.id,
      ...stage,
      actualStartDate: stage.stepNumber === 1 ? reset.startDate : null,
      status: automaticProgress.stageStatuses.get(stage.stepNumber) ?? 'scheduled',
    })))
    await db.update(idesignCases).set({ updatedAt: now }).where(eq(idesignCases.id, context.caseRow.id))
    if (context.caseRow.importedOrderId) await db.update(idesignOrders).set({
      totalSteps: String(reset.totalSteps),
      sourceUpdatedOn: dateInTimezone(now, reset.timezone),
      updatedAt: now,
    }).where(eq(idesignOrders.id, context.caseRow.importedOrderId))
    await activity(context, 'schedule_reset', `Wear schedule reset to ${reset.totalSteps} stages from ${reset.startDate}`)
    return NextResponse.json({ success: true })
  }

  if (parsed.data.action === 'pause') {
    const automaticProgress = calculateAutomaticTreatmentProgress(steps, dateInTimezone(now, course.timezone))
    const currentStage = automaticProgress?.currentStage ?? course.currentStep
    await db.update(idesignTreatmentCourses).set({ currentStep: currentStage, status: 'paused', nextSuggestedChange: null, updatedAt: now }).where(eq(idesignTreatmentCourses.id, course.id))
    if (automaticProgress) await Promise.all(steps.map((step) => db.update(idesignTreatmentSteps).set({ status: automaticProgress.stageStatuses.get(step.stepNumber) ?? step.status }).where(eq(idesignTreatmentSteps.id, step.id))))
    await activity(context, 'schedule_paused', `Treatment paused at Stage ${currentStage}`)
    return NextResponse.json({ success: true })
  }

  const current = steps.find((step) => step.stepNumber === course.currentStep)
  const anchor = parsed.data.action === 'resume'
    ? parsed.data.actualDate
    : current?.actualStartDate || current?.suggestedStartDate || course.startDate
  const durations = parsed.data.action === 'update_durations' ? parsed.data.durations : steps.map((step) => step.durationDays)
  if (durations.length !== course.totalSteps) return NextResponse.json({ error: 'Add a duration for every stage' }, { status: 400 })
  const withUpdatedDurations = steps.map((step) => ({ ...step, durationDays: durations[step.stepNumber - 1] }))
  const recalculated = recalculateRemainingSteps(withUpdatedDurations, course.currentStep, anchor)
  await updateFutureSteps(course.id, recalculated, course.currentStep, context.userId, now)
  const finish = recalculated.at(-1)?.suggestedEndDate ?? course.currentEstimatedFinish
  await db.update(idesignTreatmentCourses).set({
    status: 'active',
    currentEstimatedFinish: finish,
    nextSuggestedChange: suggestedChangeDate(recalculated, course.currentStep),
    updatedAt: now,
  }).where(eq(idesignTreatmentCourses.id, course.id))
  await activity(context, parsed.data.action === 'resume' ? 'schedule_resumed' : 'schedule_adjusted', parsed.data.action === 'resume' ? `Treatment resumed on ${anchor}` : 'Future step durations updated')
  return NextResponse.json({ success: true })
}

async function scheduleContext(id: string) {
  const { session, error } = await requireSession()
  if (error) return { response: error }
  if (!canManageIDesignSchedule(session!.user.role)) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  const caseId = Number(id)
  if (!Number.isInteger(caseId)) return { response: NextResponse.json({ error: 'Invalid case' }, { status: 400 }) }
  const userId = Number(session!.user.id)
  const caseRow = await getAccessibleIDesignCase(caseId, userId, session!.user.role)
  if (!caseRow) return { response: NextResponse.json({ error: 'Case not found' }, { status: 404 }) }
  return { session: session!, userId, caseRow }
}

async function updateFutureSteps(courseId: number, steps: ReturnType<typeof recalculateRemainingSteps>, currentStep: number, userId: number, now: Date) {
  const db = getDb()
  await Promise.all(steps.filter((step) => step.stepNumber >= currentStep).map((step) => db.update(idesignTreatmentSteps).set({
    durationDays: step.durationDays,
    suggestedStartDate: step.suggestedStartDate,
    suggestedEndDate: step.suggestedEndDate,
    actualStartDate: step.stepNumber === currentStep ? step.suggestedStartDate : null,
    status: step.stepNumber === currentStep ? 'current' : 'scheduled',
    confirmedBy: step.stepNumber === currentStep ? userId : null,
    confirmedAt: step.stepNumber === currentStep ? now : null,
  }).where(and(eq(idesignTreatmentSteps.courseId, courseId), eq(idesignTreatmentSteps.stepNumber, step.stepNumber)))))
}

async function activity(context: Exclude<Awaited<ReturnType<typeof scheduleContext>>, { response: NextResponse }>, eventType: string, detail: string) {
  return recordIDesignActivity({ caseId: context.caseRow.id, eventType, detail, ...sessionActor(context.session) })
}
