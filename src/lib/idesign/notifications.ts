import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers, idesignCases, idesignNotifications } from '@/lib/db/schema'

type CaseOwner = Pick<typeof idesignCases.$inferSelect, 'id' | 'orderNo' | 'patientName' | 'doctorAccountId' | 'salesAccountId'>

export async function notifyIDesignCase(caseRow: CaseOwner, event: {
  type: string
  title: string
  body: string
  dedupeKey: string
  audience: 'clinical' | 'lab' | 'clinical_and_sales'
}) {
  const recipients = await recipientAccounts(caseRow, event.audience)
  if (recipients.length === 0) return 0

  const inserted = await getDb().insert(idesignNotifications).values(recipients.map((recipient) => ({
    userId: recipient.id,
    caseId: caseRow.id,
    eventType: event.type,
    title: event.title,
    body: event.body,
    dedupeKey: event.dedupeKey,
  }))).onConflictDoNothing().returning({ id: idesignNotifications.id, userId: idesignNotifications.userId })

  const insertedByUser = new Map(inserted.map((notification) => [notification.userId, notification.id]))
  await Promise.all(recipients.flatMap((recipient) => {
    const notificationId = insertedByUser.get(recipient.id)
    const email = recipient.email || (recipient.username.includes('@') ? recipient.username : null)
    if (!notificationId || !email) return []
    return [sendIDesignEmail(email, event.title, `${event.body}\n\nOrder: ${caseRow.orderNo}\nPatient: ${caseRow.patientName}`, caseRow.id, recipient.role)
      .then(async (sent) => {
        if (sent) await getDb().update(idesignNotifications).set({ emailSentAt: new Date() }).where(eq(idesignNotifications.id, notificationId))
      })]
  }))

  return inserted.length
}

async function recipientAccounts(caseRow: CaseOwner, audience: 'clinical' | 'lab' | 'clinical_and_sales') {
  const db = getDb()
  const clinicalIds = [caseRow.doctorAccountId].filter((id): id is number => Boolean(id))
  const conditions = []
  if (audience === 'clinical' || audience === 'clinical_and_sales') {
    if (clinicalIds.length) conditions.push(inArray(adminUsers.id, clinicalIds))
    if (caseRow.doctorAccountId) conditions.push(and(eq(adminUsers.role, 'clinic_staff'), eq(adminUsers.linkedDoctorId, caseRow.doctorAccountId)))
  }
  if (audience === 'lab') conditions.push(or(eq(adminUsers.role, 'admin'), eq(adminUsers.role, 'superadmin'))!)
  if (audience === 'clinical_and_sales' && caseRow.salesAccountId) conditions.push(eq(adminUsers.id, caseRow.salesAccountId))
  if (conditions.length === 0) return []

  return db.select({
    id: adminUsers.id,
    username: adminUsers.username,
    email: adminUsers.email,
    role: adminUsers.role,
  }).from(adminUsers).where(and(eq(adminUsers.isActive, true), or(...conditions)!))
}

async function sendIDesignEmail(email: string, subject: string, message: string, caseId: number, role: string) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) return false
  const appUrl = process.env.APP_URL?.replace(/\/$/, '')
  const detailPath = role === 'doctor' || role === 'clinic_staff'
    ? `/portal/idesign/orders/${caseId}`
    : `/admin/idesign/orders/${caseId}`
  const link = appUrl ? `\n\nOpen case: ${appUrl}${detailPath}` : ''
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject, text: `${message}${link}` }),
      signal: AbortSignal.timeout(10000),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function markIDesignNotificationRead(notificationId: number, userId: number) {
  const [updated] = await getDb().update(idesignNotifications).set({ readAt: new Date() }).where(and(
    eq(idesignNotifications.id, notificationId),
    eq(idesignNotifications.userId, userId),
    isNull(idesignNotifications.readAt),
  )).returning({ id: idesignNotifications.id })
  return Boolean(updated)
}
