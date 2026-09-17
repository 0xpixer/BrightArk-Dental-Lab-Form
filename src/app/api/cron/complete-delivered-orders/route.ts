import { NextRequest, NextResponse } from 'next/server'
import { and, eq, lte } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { orderActivities, orders } from '@/lib/db/schema'
import { DELIVERED_AUTO_COMPLETE_MS } from '@/lib/orderStatus'

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const completedAt = new Date()
  const completedOrders = await db
    .update(orders)
    .set({ status: 'completed', statusUpdatedAt: completedAt })
    .where(and(
      eq(orders.status, 'delivered'),
      lte(orders.statusUpdatedAt, new Date(completedAt.getTime() - DELIVERED_AUTO_COMPLETE_MS)),
    ))
    .returning({ id: orders.id })
  if (completedOrders.length > 0) {
    await db.insert(orderActivities).values(completedOrders.map((order) => ({
      orderId: order.id,
      eventType: 'status',
      detail: 'completed',
      actorRole: 'system',
      actorName: 'System',
      createdAt: completedAt,
    })))
  }

  return NextResponse.json({ success: true, autoCompleted: completedOrders.length })
}
