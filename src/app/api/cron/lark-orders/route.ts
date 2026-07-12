import { NextRequest, NextResponse } from 'next/server'
import { eq, isNull } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { larkNotifications, orders } from '@/lib/db/schema'

const MAX_ORDERS_PER_RUN = 50

function getAppUrl(request: NextRequest) {
  return (process.env.APP_URL ?? request.nextUrl.origin).replace(/\/$/, '')
}

function buildLarkMessage(order: {
  id: number
  orderNo: string
  clinic: string
  treatmentType: string | null
  createdAt: Date
}, appUrl: string) {
  return [
    'New BrightArk case submitted',
    `Order: ${order.orderNo}`,
    `Clinic: ${order.clinic}`,
    `Treatment: ${order.treatmentType ?? 'Not selected'}`,
    `Submitted: ${order.createdAt.toLocaleString('en-AU', { timeZone: 'Asia/Jakarta' })} WIB`,
    `View: ${appUrl}/admin/submissions/${order.id}`,
  ].join('\n')
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const webhookUrl = process.env.LARK_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json({ error: 'LARK_WEBHOOK_URL is not configured' }, { status: 503 })
  }

  const db = getDb()
  const pendingOrders = await db
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      clinic: orders.clinic,
      treatmentType: orders.treatmentType,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(larkNotifications, eq(larkNotifications.orderId, orders.id))
    .where(isNull(larkNotifications.id))
    .orderBy(orders.createdAt)
    .limit(MAX_ORDERS_PER_RUN)

  const appUrl = getAppUrl(request)
  let sent = 0
  const failures: string[] = []

  for (const order of pendingOrders) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msg_type: 'text',
          content: { text: buildLarkMessage(order, appUrl) },
        }),
      })
      if (!response.ok) throw new Error(`Lark webhook returned ${response.status}`)

      await db.insert(larkNotifications).values({ orderId: order.id }).onConflictDoNothing()
      sent += 1
    } catch (error) {
      console.error(`Lark notification failed for order ${order.orderNo}:`, error)
      failures.push(order.orderNo)
    }
  }

  return NextResponse.json({ success: failures.length === 0, sent, failures })
}
