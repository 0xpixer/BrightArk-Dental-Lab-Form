import { NextResponse } from 'next/server'
import { desc, getTableColumns } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { requirePortalUser } from '@/lib/admin/session'
import { getOrderOwnerId } from '@/lib/portal/access'
import { doctorOrderScope } from '@/lib/portal/orderScope'
import { hasUnreadOrderMessage } from '@/lib/orderUnread'

export async function GET() {
  const { session, error } = await requirePortalUser()
  if (error) return error
  const userId = parseInt(session!.user.id, 10)
  const ownerId = await getOrderOwnerId(userId, session!.user.role)
  if (!ownerId) return NextResponse.json({ error: 'Clinic staff is not linked to a doctor' }, { status: 403 })
  const db = getDb()
  const accessCondition = doctorOrderScope([ownerId])
  const rows = await db
    .select({ ...getTableColumns(orders), hasUnreadMessage: hasUnreadOrderMessage(userId) })
    .from(orders)
    .where(accessCondition)
    .orderBy(desc(orders.createdAt))
  return NextResponse.json({ orders: rows })
}
