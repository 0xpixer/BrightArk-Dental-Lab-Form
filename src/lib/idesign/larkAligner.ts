import { waitUntil } from '@vercel/functions'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers, idesignOrders } from '@/lib/db/schema'
import { notifyLarkOfAlignerCase, type LarkAlignerEvent } from '@/lib/lark'

interface AlignerCaseRow {
  id: number
  orderNo: string
  patientName: string
  doctorAccountId: number | null
  importedOrderId: number | null
}

async function resolveDoctor(caseRow: AlignerCaseRow) {
  const db = getDb()
  const [doctor] = caseRow.doctorAccountId
    ? await db.select({ fullName: adminUsers.fullName, username: adminUsers.username, clinicName: adminUsers.clinicName })
      .from(adminUsers).where(eq(adminUsers.id, caseRow.doctorAccountId)).limit(1)
    : []
  let doctorName = doctor ? doctor.fullName || doctor.username : null
  if (!doctorName && caseRow.importedOrderId) {
    const [imported] = await db.select({ doctorName: idesignOrders.doctorName })
      .from(idesignOrders).where(eq(idesignOrders.id, caseRow.importedOrderId)).limit(1)
    doctorName = imported?.doctorName ?? null
  }
  return { doctorName, clinic: doctor?.clinicName ?? null }
}

/**
 * Queues a Lark message for a clear aligner order in the background.
 * Never throws and never delays the response; skips when LARK_ALIGNER_WEBHOOK_URL is unset.
 */
export function queueAlignerLarkNotification(
  event: LarkAlignerEvent,
  caseRow: AlignerCaseRow,
  request: Request,
  extra: { planVersion?: number | null } = {},
) {
  const webhookUrl = process.env.LARK_ALIGNER_WEBHOOK_URL
  if (!webhookUrl) return
  const appUrl = process.env.APP_URL || new URL(request.url).origin
  const occurredAt = new Date()
  waitUntil((async () => {
    try {
      const { doctorName, clinic } = await resolveDoctor(caseRow)
      await notifyLarkOfAlignerCase(event, {
        id: caseRow.id,
        orderNo: caseRow.orderNo,
        patientName: caseRow.patientName,
        doctorName,
        clinic,
        planVersion: extra.planVersion,
      }, { webhookUrl, appUrl, occurredAt })
    } catch (error) {
      console.error(`Lark aligner ${event} notification failed for order ${caseRow.orderNo}:`, error)
    }
  })())
}
