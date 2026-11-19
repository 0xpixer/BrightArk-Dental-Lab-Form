import { and, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers, salesDoctorAssignments } from '@/lib/db/schema'
import { accountEmail, appLink, sendTransactionalEmail } from '@/lib/email'

export const RELATIONSHIPS_PATH = '/admin/accounts?tab=relationships'

export function unassignedDoctorEmail(doctor: { fullName: string | null; username: string; clinicName: string | null; country: string | null; city: string | null; salesReferral: string | null }, link: string | null) {
  const name = doctor.fullName || doctor.username
  const place = [doctor.city, doctor.country].filter(Boolean).join(', ')
  const lines = [
    `${name} just registered on the BrightArk Order Portal and has no sales rep yet.`,
    '',
    `Clinic: ${doctor.clinicName || '—'}`,
    place ? `Location: ${place}` : null,
    `Sales rep named at sign-up: ${doctor.salesReferral || 'none'}`,
    '',
    'Until a sales rep is assigned, no one on the sales team sees this doctor or their orders.',
    link ? `Assign a sales rep: ${link}` : null,
  ].filter((line): line is string => line !== null)
  return { subject: `New doctor without a sales rep: ${name}`, text: lines.join('\n') }
}

/** Emails every active Superadmin when a newly registered doctor has no sales rep. Never throws. */
export async function notifyUnassignedDoctor(doctorId: number) {
  try {
    const db = getDb()
    const [doctor] = await db.select().from(adminUsers).where(and(eq(adminUsers.id, doctorId), eq(adminUsers.role, 'doctor'))).limit(1)
    if (!doctor) return 0
    const [assigned] = await db.select({ salesId: salesDoctorAssignments.salesId }).from(salesDoctorAssignments).where(eq(salesDoctorAssignments.doctorId, doctorId)).limit(1)
    if (assigned) return 0
    const superadmins = await db.select({ email: adminUsers.email, username: adminUsers.username })
      .from(adminUsers).where(and(eq(adminUsers.role, 'superadmin'), eq(adminUsers.isActive, true)))
    const recipients = [...new Set(superadmins.map(accountEmail).filter((email): email is string => Boolean(email)))]
    const { subject, text } = unassignedDoctorEmail(doctor, appLink(RELATIONSHIPS_PATH))
    await Promise.all(recipients.map((to) => sendTransactionalEmail({ to, subject, text })))
    return recipients.length
  } catch (error) {
    console.error('Unassigned doctor email failed', error instanceof Error ? error.message : error)
    return 0
  }
}
