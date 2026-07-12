import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/admin/session'
import { buildOrderZip } from '@/lib/admin/buildOrderZip'

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { error } = await requireAdmin()
  if (error) return error

  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
  }

  const db = getDb()
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const zipBuffer = await buildOrderZip(order, request.url)

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="order_${order.orderNo}.zip"`,
    },
  })
}
