import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { requirePortalUser } from '@/lib/admin/session'
import { getOrderOwnerId } from '@/lib/portal/access'
import { mapFormValuesToOrderUpdate } from '@/lib/transformOrder'
import { orderFormSchema } from '@/types/orderForm'

async function getAccessibleOrder(id: number, userId: number, role: string) {
  const ownerId = await getOrderOwnerId(userId, role)
  if (!ownerId) return null
  const db = getDb()
  const [order] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.submittedBy, ownerId))).limit(1)
  return order ?? null
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requirePortalUser()
  if (error) return error
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
  const order = await getAccessibleOrder(id, parseInt(session!.user.id, 10), session!.user.role)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  return NextResponse.json({ order })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requirePortalUser()
  if (error) return error
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
  const order = await getAccessibleOrder(id, parseInt(session!.user.id, 10), session!.user.role)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'pending') return NextResponse.json({ error: 'Only pending orders can be edited' }, { status: 409 })

  const body = await request.json()
  const parsed = orderFormSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Please correct the order form fields' }, { status: 400 })

  const incomingFiles = typeof body.file_urls === 'object' && body.file_urls ? body.file_urls : {}
  const db = getDb()
  const [updated] = await db
    .update(orders)
    .set(mapFormValuesToOrderUpdate(parsed.data, { ...(order.fileUrls as Record<string, string> ?? {}), ...incomingFiles }))
    .where(eq(orders.id, order.id))
    .returning({ orderNo: orders.orderNo })

  return NextResponse.json({ success: true, orderNo: updated.orderNo })
}
