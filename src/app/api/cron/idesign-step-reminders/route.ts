import { asc, eq, inArray } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { idesignCases, idesignTreatmentCourses, idesignTreatmentSteps } from '@/lib/db/schema'
import { notifyIDesignCase } from '@/lib/idesign/notifications'
import { addDaysToDate, calculateAutomaticTreatmentProgress, dateInTimezone } from '@/lib/idesign/schedule'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const today = dateInTimezone(now, 'Asia/Jakarta')
  const tomorrow = addDaysToDate(today, 1)
  const db = getDb()
  const activeCourses = await db.select({
    id: idesignCases.id,
    courseId: idesignTreatmentCourses.id,
    currentStep: idesignTreatmentCourses.currentStep,
    totalSteps: idesignTreatmentCourses.totalSteps,
    nextSuggestedChange: idesignTreatmentCourses.nextSuggestedChange,
    timezone: idesignTreatmentCourses.timezone,
    caseId: idesignCases.id,
    orderNo: idesignCases.orderNo,
    patientName: idesignCases.patientName,
    doctorAccountId: idesignCases.doctorAccountId,
    salesAccountId: idesignCases.salesAccountId,
  }).from(idesignTreatmentCourses).innerJoin(idesignCases, eq(idesignCases.id, idesignTreatmentCourses.caseId)).where(eq(idesignTreatmentCourses.status, 'active'))

  const courseIds = activeCourses.map((course) => course.courseId)
  const stages = courseIds.length
    ? await db.select({ courseId: idesignTreatmentSteps.courseId, stepNumber: idesignTreatmentSteps.stepNumber, suggestedStartDate: idesignTreatmentSteps.suggestedStartDate, suggestedEndDate: idesignTreatmentSteps.suggestedEndDate }).from(idesignTreatmentSteps).where(inArray(idesignTreatmentSteps.courseId, courseIds)).orderBy(asc(idesignTreatmentSteps.stepNumber))
    : []
  const stagesByCourse = new Map<number, typeof stages>()
  for (const stage of stages) {
    const courseStages = stagesByCourse.get(stage.courseId) ?? []
    courseStages.push(stage)
    stagesByCourse.set(stage.courseId, courseStages)
  }

  const calculated = activeCourses.flatMap((course) => {
    const progress = calculateAutomaticTreatmentProgress(stagesByCourse.get(course.courseId) ?? [], dateInTimezone(now, course.timezone))
    return progress ? [{ course, progress }] : []
  })
  await Promise.all(calculated.filter(({ course, progress }) =>
    course.currentStep !== progress.currentStage || course.nextSuggestedChange !== progress.nextSuggestedChange || progress.status === 'completed'
  ).map(({ course, progress }) => db.update(idesignTreatmentCourses).set({
    currentStep: progress.currentStage,
    nextSuggestedChange: progress.nextSuggestedChange,
    status: progress.status,
    updatedAt: now,
  }).where(eq(idesignTreatmentCourses.id, course.courseId))))

  const due = calculated.filter(({ progress }) => progress.status === 'active' && progress.nextSuggestedChange === tomorrow)

  let sent = 0
  for (const { course: item, progress } of due) {
    sent += await notifyIDesignCase(item, {
      type: 'step_reminder',
      title: 'Suggested aligner change tomorrow',
      body: `${item.patientName} is scheduled to move from Stage ${progress.currentStage} to Stage ${Math.min(progress.currentStage + 1, item.totalSteps)} tomorrow.`,
      dedupeKey: `stage-reminder-${item.courseId}-${progress.currentStage}-${tomorrow}`,
      audience: 'clinical',
    })
  }
  return NextResponse.json({ success: true, dueCourses: due.length, notificationsCreated: sent, reminderDate: tomorrow })
}
