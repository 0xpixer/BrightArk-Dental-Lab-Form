import { and, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { getOrderOwnerId } from './access'
import { doctorOrderScope } from './orderScope'

export async function getAccessiblePortalOrder(id: number, userId: number, role: string) {
  const ownerId = await getOrderOwnerId(userId, role)
  if (!ownerId) return null

  const accessCondition = doctorOrderScope([ownerId])
  const db = getDb()
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), accessCondition))
    .limit(1)

  return order ?? null
}
