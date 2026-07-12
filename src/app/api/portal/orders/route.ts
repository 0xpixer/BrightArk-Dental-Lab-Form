import { NextResponse } from 'next/server'
import { and, desc, eq, isNull, or } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { requirePortalUser } from '@/lib/admin/session'
import { getDoctorProfile, getOrderOwnerId } from '@/lib/portal/access'

export async function GET() {
  const { session, error } = await requirePortalUser()
  if (error) return error
  const ownerId = await getOrderOwnerId(parseInt(session!.user.id, 10), session!.user.role)
  if (!ownerId) return NextResponse.json({ error: 'Clinic staff is not linked to a doctor' }, { status: 403 })
  const doctor = await getDoctorProfile(ownerId)

  const db = getDb()
  const accessCondition = doctor?.email
    ? or(eq(orders.submittedBy, ownerId), and(isNull(orders.submittedBy), eq(orders.email, doctor.email)))
    : eq(orders.submittedBy, ownerId)
  const rows = await db.select().from(orders).where(accessCondition).orderBy(desc(orders.createdAt))
  return NextResponse.json({ orders: rows })
}
