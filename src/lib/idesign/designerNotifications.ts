import { waitUntil } from '@vercel/functions'
import type { LarkAlignerEvent } from '@/lib/lark'
import { notifyIDesignCase } from '@/lib/idesign/notifications'
import { resolveAlignerDoctor, type AlignerCaseRow } from '@/lib/idesign/larkAligner'

export interface DesignerNotificationInput {
  caseId: number
  orderNo: string
  patientName: string
  doctorName: string | null
  clinic: string | null
  planId?: number | null
  planVersion?: number | null
}

/** Builds the in-app/email notification sent to treatment plan designers for a clear aligner event. */
export function buildDesignerNotification(event: LarkAlignerEvent, input: DesignerNotificationInput) {
  const patient = input.patientName.trim() || 'Not provided'
  const details = [
    `Order: ${input.orderNo}`,
    `Doctor: ${input.doctorName?.trim() || 'Not assigned'}`,
    `Clinic: ${input.clinic?.trim() || 'Not provided'}`,
    `Patient: ${patient}`,
  ].join('\n')

  if (event === 'approved') {
    const version = input.planVersion ? ` V${input.planVersion}` : ''
    return {
      type: 'designer_plan_approved',
      title: `Treatment plan${version} approved — ${input.orderNo}`,
      body: `The doctor approved treatment plan${version} for ${patient}.\n\n${details}`,
      dedupeKey: `designer-plan-approved-${input.planId ?? input.caseId}`,
    }
  }
  return {
    type: 'designer_case_submitted',
    title: `New clear aligner order — ${input.orderNo}`,
    body: `A new clear aligner order was submitted for ${patient}.\n\n${details}`,
    dedupeKey: `designer-case-submitted-${input.caseId}`,
  }
}

type DesignerCaseRow = AlignerCaseRow & { salesAccountId: number | null }

/**
 * Notifies every active treatment plan designer (in-app + email via Resend) in the background.
 * Never throws and never delays the response.
 */
export function queueDesignerAlignerNotification(
  event: LarkAlignerEvent,
  caseRow: DesignerCaseRow,
  extra: { planId?: number | null; planVersion?: number | null } = {},
) {
  waitUntil((async () => {
    try {
      const { doctorName, clinic } = await resolveAlignerDoctor(caseRow)
      const notification = buildDesignerNotification(event, {
        caseId: caseRow.id,
        orderNo: caseRow.orderNo,
        patientName: caseRow.patientName,
        doctorName,
        clinic,
        planId: extra.planId,
        planVersion: extra.planVersion,
      })
      await notifyIDesignCase(caseRow, { ...notification, audience: 'designers' })
    } catch (error) {
      console.error(`Designer ${event} notification failed for order ${caseRow.orderNo}:`, error)
    }
  })())
}
