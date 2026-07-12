import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { orders, sharedLinks } from '@/lib/db/schema'
import { buildOrderZip } from '@/lib/admin/buildOrderZip'

export async function GET(
  request: Request,
  { params }: { params: { token: string } },
) {
  const db = getDb()

  const [link] = await db
    .select()
    .from(sharedLinks)
    .where(eq(sharedLinks.token, params.token))
    .limit(1)

  if (!link) {
    return NextResponse.json({ error: 'Link not found or expired' }, { status: 404 })
  }

  if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'This link has expired' }, { status: 410 })
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, link.orderId)).limit(1)

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  await db
    .update(sharedLinks)
    .set({ downloadCount: link.downloadCount + 1 })
    .where(eq(sharedLinks.id, link.id))

  const zipBuffer = await buildOrderZip(order, request.url)

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="order_${order.orderNo}.zip"`,
    },
  })
}
