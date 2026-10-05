import { and, eq } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { idesignCases, idesignTreatmentCourses } from '@/lib/db/schema'
import { notifyIDesignCase } from '@/lib/idesign/notifications'
import { addDaysToDate } from '@/lib/idesign/schedule'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = dateInTimezone(new Date(), 'Asia/Jakarta')
  const tomorrow = addDaysToDate(today, 1)
  const due = await getDb().select({
    id: idesignCases.id,
    courseId: idesignTreatmentCourses.id,
    currentStep: idesignTreatmentCourses.currentStep,
    totalSteps: idesignTreatmentCourses.totalSteps,
    caseId: idesignCases.id,
    orderNo: idesignCases.orderNo,
    patientName: idesignCases.patientName,
    doctorAccountId: idesignCases.doctorAccountId,
    salesAccountId: idesignCases.salesAccountId,
  }).from(idesignTreatmentCourses).innerJoin(idesignCases, eq(idesignCases.id, idesignTreatmentCourses.caseId)).where(and(
    eq(idesignTreatmentCourses.status, 'active'),
    eq(idesignTreatmentCourses.nextSuggestedChange, tomorrow),
  ))

  let sent = 0
  for (const item of due) {
    sent += await notifyIDesignCase(item, {
      type: 'step_reminder',
      title: 'Suggested aligner change tomorrow',
      body: `${item.patientName} is scheduled to move from step ${item.currentStep} to step ${Math.min(item.currentStep + 1, item.totalSteps)} tomorrow. Please confirm whether the patient is ready to proceed.`,
      dedupeKey: `step-reminder-${item.courseId}-${item.currentStep}-${tomorrow}`,
      audience: 'clinical',
    })
  }
  return NextResponse.json({ success: true, dueCourses: due.length, notificationsCreated: sent, reminderDate: tomorrow })
}

function dateInTimezone(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}
