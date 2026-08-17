import { and, eq, isNull, or } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { getDoctorProfile, getOrderOwnerId } from './access'

export async function getAccessiblePortalOrder(id: number, userId: number, role: string) {
  const ownerId = await getOrderOwnerId(userId, role)
  if (!ownerId) return null

  const doctor = await getDoctorProfile(ownerId)
  const accessCondition = doctor?.email
    ? or(eq(orders.submittedBy, ownerId), and(isNull(orders.submittedBy), eq(orders.email, doctor.email)))
    : eq(orders.submittedBy, ownerId)
  const db = getDb()
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), accessCondition))
    .limit(1)

  return order ?? null
}
