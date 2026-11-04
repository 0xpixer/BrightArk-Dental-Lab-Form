import { and, asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { idesignOrders, idesignTreatmentCourses, idesignTreatmentSteps } from '@/lib/db/schema'
import { canManageIDesignSchedule } from '@/lib/idesign/access'
import {
  calculateEstimatedFinish,
  calculateTreatmentSteps,
  recalculateRemainingSteps,
  startTreatmentCourseSchema,
  suggestedChangeDate,
  updateTreatmentDurationsSchema,
} from '@/lib/idesign/schedule'
import { getAccessibleIDesignCase, recordIDesignActivity, sessionActor } from '@/lib/idesign/workflow'

const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('advance'), actualDate: dateValue }),
  z.object({ action: z.literal('pause') }),
  z.object({ action: z.literal('resume'), actualDate: dateValue }),
  z.object({ action: z.literal('update_durations'), durations: updateTreatmentDurationsSchema.shape.durations }),
  z.object({ action: z.literal('complete'), actualDate: dateValue }),
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
  const [course] = await db.insert(idesignTreatmentCourses).values({
    caseId: context.caseRow.id,
    startDate: parsed.data.startDate,
    totalSteps: parsed.data.totalSteps,
    defaultDurationDays: parsed.data.defaultDurationDays,
    currentStep: 1,
    originalEstimatedFinish: estimatedFinish,
    currentEstimatedFinish: estimatedFinish,
    nextSuggestedChange: suggestedChangeDate(steps, 1),
    timezone: parsed.data.timezone,
    status: 'active',
    createdBy: context.userId,
  }).returning()
  await db.insert(idesignTreatmentSteps).values(steps.map((step) => ({
    courseId: course.id,
    ...step,
    actualStartDate: step.stepNumber === 1 ? parsed.data.startDate : null,
    status: step.stepNumber === 1 ? 'current' : 'scheduled',
  })))
  if (context.caseRow.importedOrderId) await db.update(idesignOrders).set({ totalSteps: String(parsed.data.totalSteps), updatedAt: new Date() }).where(eq(idesignOrders.id, context.caseRow.importedOrderId))
  await recordIDesignActivity({ caseId: context.caseRow.id, eventType: 'schedule_started', detail: `Wear schedule started with ${parsed.data.totalSteps} steps`, ...sessionActor(context.session) })
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

  if (parsed.data.action === 'pause') {
    await db.update(idesignTreatmentCourses).set({ status: 'paused', nextSuggestedChange: null, updatedAt: now }).where(eq(idesignTreatmentCourses.id, course.id))
    await activity(context, 'schedule_paused', `Treatment paused at step ${course.currentStep}`)
    return NextResponse.json({ success: true })
  }

  if (parsed.data.action === 'complete') {
    await db.update(idesignTreatmentCourses).set({ status: 'completed', currentEstimatedFinish: parsed.data.actualDate, nextSuggestedChange: null, updatedAt: now }).where(eq(idesignTreatmentCourses.id, course.id))
    await db.update(idesignTreatmentSteps).set({ status: 'completed', confirmedBy: context.userId, confirmedAt: now }).where(eq(idesignTreatmentSteps.id, steps[Math.max(0, course.currentStep - 1)].id))
    await activity(context, 'schedule_completed', `Treatment completed on ${parsed.data.actualDate}`)
    return NextResponse.json({ success: true })
  }

  if (parsed.data.action === 'advance') {
    if (course.status === 'paused') return NextResponse.json({ error: 'Resume the treatment before changing steps' }, { status: 400 })
    const current = steps.find((step) => step.stepNumber === course.currentStep)
    if (!current) return NextResponse.json({ error: 'Current step is unavailable' }, { status: 400 })
    await db.update(idesignTreatmentSteps).set({ status: 'completed', confirmedBy: context.userId, confirmedAt: now }).where(eq(idesignTreatmentSteps.id, current.id))
    if (course.currentStep >= course.totalSteps) {
      await db.update(idesignTreatmentCourses).set({ status: 'completed', currentEstimatedFinish: parsed.data.actualDate, nextSuggestedChange: null, updatedAt: now }).where(eq(idesignTreatmentCourses.id, course.id))
      await activity(context, 'schedule_completed', `Treatment completed on ${parsed.data.actualDate}`)
      return NextResponse.json({ success: true })
    }
    const nextStep = course.currentStep + 1
    const recalculated = recalculateRemainingSteps(steps, nextStep, parsed.data.actualDate)
    await updateFutureSteps(course.id, recalculated, nextStep, context.userId, now)
    const finish = recalculated.at(-1)?.suggestedEndDate ?? course.currentEstimatedFinish
    await db.update(idesignTreatmentCourses).set({ currentStep: nextStep, status: 'active', currentEstimatedFinish: finish, nextSuggestedChange: suggestedChangeDate(recalculated, nextStep), updatedAt: now }).where(eq(idesignTreatmentCourses.id, course.id))
    await activity(context, 'step_changed', `Changed to step ${nextStep} on ${parsed.data.actualDate}`)
    return NextResponse.json({ success: true })
  }

  const current = steps.find((step) => step.stepNumber === course.currentStep)
  const anchor = parsed.data.action === 'resume'
    ? parsed.data.actualDate
    : current?.actualStartDate || current?.suggestedStartDate || course.startDate
  const durations = parsed.data.action === 'update_durations' ? parsed.data.durations : steps.map((step) => step.durationDays)
  if (durations.length !== course.totalSteps) return NextResponse.json({ error: 'Add a duration for every step' }, { status: 400 })
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
