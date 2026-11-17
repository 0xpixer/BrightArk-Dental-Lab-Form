import { and, eq, inArray, or } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers, orders, salesDoctorAssignments } from '@/lib/db/schema'
import { SALES_ROLES } from '@/lib/admin/roles'
import { accountEmail, appLink, sendTransactionalEmail } from '@/lib/email'
import { labNewOrderEmail, labOrderPath, labStatusEmail, type LabOrderEmailInput } from '@/lib/labOrderEmailContent'

// Dental Lab order emails. Lab Admins only ever receive Dental Lab emails; clear aligner email goes elsewhere.

interface Recipient { email: string; role: string }

function uniqueRecipients(accounts: Array<{ email: string | null; username: string; role: string }>): Recipient[] {
  const seen = new Set<string>()
  const result: Recipient[] = []
  for (const account of accounts) {
    const email = accountEmail(account)?.toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)
    result.push({ email, role: account.role })
  }
  return result
}

async function loadOrder(orderId: number) {
  const [order] = await getDb().select({
    id: orders.id,
    orderNo: orders.orderNo,
    patientName: orders.patientName,
    clinic: orders.clinic,
    treatmentType: orders.treatmentType,
    submittedBy: orders.submittedBy,
    email: orders.email,
  }).from(orders).where(eq(orders.id, orderId)).limit(1)
  return order ?? null
}

/** New order: every active Lab Admin and superadmin. */
export async function sendLabNewOrderEmails(order: LabOrderEmailInput & { submittedBy: number | null }) {
  const db = getDb()
  const [labAccounts, doctor] = await Promise.all([
    db.select({ email: adminUsers.email, username: adminUsers.username, role: adminUsers.role })
      .from(adminUsers)
      .where(and(eq(adminUsers.isActive, true), inArray(adminUsers.role, ['admin', 'superadmin']))),
    order.submittedBy
      ? db.select({ fullName: adminUsers.fullName, username: adminUsers.username }).from(adminUsers).where(eq(adminUsers.id, order.submittedBy)).limit(1).then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ])
  const recipients = uniqueRecipients(labAccounts)
  await Promise.all(recipients.map((recipient) => {
    const { subject, text } = labNewOrderEmail(order, doctor?.fullName || doctor?.username || null, appLink(labOrderPath(recipient.role, order.id)))
    return sendTransactionalEmail({ to: recipient.email, subject, text })
  }))
  return recipients.length
}

/** Status change: the ordering doctor, their linked clinic staff and their assigned sales. */
export async function sendLabStatusEmails(orderId: number, status: string) {
  const order = await loadOrder(orderId)
  if (!order) return 0
  const db = getDb()
  let accounts: Array<{ email: string | null; username: string; role: string }> = []
  if (order.submittedBy) {
    const salesIds = (await db.select({ salesId: salesDoctorAssignments.salesId }).from(salesDoctorAssignments).where(eq(salesDoctorAssignments.doctorId, order.submittedBy))).map((row) => row.salesId)
    accounts = await db.select({ email: adminUsers.email, username: adminUsers.username, role: adminUsers.role })
      .from(adminUsers)
      .where(and(
        eq(adminUsers.isActive, true),
        or(
          eq(adminUsers.id, order.submittedBy),
          and(eq(adminUsers.role, 'clinic_staff'), eq(adminUsers.linkedDoctorId, order.submittedBy)),
          salesIds.length ? and(inArray(adminUsers.id, salesIds), inArray(adminUsers.role, [...SALES_ROLES])) : undefined,
        ),
      ))
  } else if (order.email) {
    // Orders submitted without an account fall back to the email typed on the order form.
    accounts = [{ email: order.email, username: order.email, role: 'doctor' }]
  }
  const recipients = uniqueRecipients(accounts)
  await Promise.all(recipients.map((recipient) => {
    const { subject, text } = labStatusEmail(order, status, appLink(labOrderPath(recipient.role, order.id)))
    return sendTransactionalEmail({ to: recipient.email, subject, text })
  }))
  return recipients.length
}
