import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { orders, sharedLinks } from '@/lib/db/schema'

export async function GET(
  _request: Request,
  { params }: { params: { token: string } },
) {
  const db = getDb()

  const [link] = await db
    .select()
    .from(sharedLinks)
    .where(eq(sharedLinks.token, params.token))
    .limit(1)

  if (!link) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  }

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, link.orderId)).limit(1)

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({
    order: {
      orderNo: order.orderNo,
      patientName: order.patientName,
      dateSent: order.dateSent,
    },
    downloadCount: link.downloadCount,
  })
}
