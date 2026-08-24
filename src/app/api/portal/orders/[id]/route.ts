import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { orderActivities, orders } from '@/lib/db/schema'
import { requirePortalUser } from '@/lib/admin/session'
import { getOrderOwnerId } from '@/lib/portal/access'
import { getAccessiblePortalOrder } from '@/lib/portal/orderAccess'
import { mapFormValuesToOrderUpdate } from '@/lib/transformOrder'
import { orderFormSchema } from '@/types/orderForm'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requirePortalUser()
  if (error) return error
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
  const order = await getAccessiblePortalOrder(id, parseInt(session!.user.id, 10), session!.user.role)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  const activities = await getDb().select().from(orderActivities).where(eq(orderActivities.orderId, id)).orderBy(desc(orderActivities.createdAt))
  return NextResponse.json({ order, activities })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requirePortalUser()
  if (error) return error
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
  const order = await getAccessiblePortalOrder(id, parseInt(session!.user.id, 10), session!.user.role)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.status !== 'pending') return NextResponse.json({ error: 'Only pending orders can be edited' }, { status: 409 })

  const body = await request.json()
  const parsed = orderFormSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Please correct the order form fields' }, { status: 400 })

  const incomingFiles = typeof body.file_urls === 'object' && body.file_urls ? body.file_urls : {}
  const ownerId = await getOrderOwnerId(parseInt(session!.user.id, 10), session!.user.role)
  const db = getDb()
  const [updated] = await db
    .update(orders)
    .set({ ...mapFormValuesToOrderUpdate(parsed.data, { ...(order.fileUrls as Record<string, string> ?? {}), ...incomingFiles }), submittedBy: ownerId })
    .where(eq(orders.id, order.id))
    .returning({ orderNo: orders.orderNo })

  return NextResponse.json({ success: true, orderNo: updated.orderNo })
}
