import { NextResponse } from 'next/server'
import { and, eq, isNull, or } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { requirePortalUser } from '@/lib/admin/session'
import { getDoctorProfile, getOrderOwnerId } from '@/lib/portal/access'
import { mapFormValuesToOrderUpdate } from '@/lib/transformOrder'
import { orderFormSchema } from '@/types/orderForm'

async function getAccessibleOrder(id: number, userId: number, role: string) {
  const ownerId = await getOrderOwnerId(userId, role)
  if (!ownerId) return null
  const doctor = await getDoctorProfile(ownerId)
  const db = getDb()
  const accessCondition = doctor?.email
    ? or(eq(orders.submittedBy, ownerId), and(isNull(orders.submittedBy), eq(orders.email, doctor.email)))
    : eq(orders.submittedBy, ownerId)
  const [order] = await db.select().from(orders).where(and(eq(orders.id, id), accessCondition)).limit(1)
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
  const ownerId = await getOrderOwnerId(parseInt(session!.user.id, 10), session!.user.role)
  const db = getDb()
  const [updated] = await db
    .update(orders)
    .set({ ...mapFormValuesToOrderUpdate(parsed.data, { ...(order.fileUrls as Record<string, string> ?? {}), ...incomingFiles }), submittedBy: ownerId })
    .where(eq(orders.id, order.id))
    .returning({ orderNo: orders.orderNo })

  return NextResponse.json({ success: true, orderNo: updated.orderNo })
}
