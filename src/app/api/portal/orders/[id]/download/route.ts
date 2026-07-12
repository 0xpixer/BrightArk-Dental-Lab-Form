import { NextResponse } from 'next/server'
import { and, eq, isNull, or } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { requirePortalUser } from '@/lib/admin/session'
import { getDoctorProfile, getOrderOwnerId } from '@/lib/portal/access'
import { buildOrderZip } from '@/lib/admin/buildOrderZip'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requirePortalUser()
  if (error) return error
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
  const ownerId = await getOrderOwnerId(parseInt(session!.user.id, 10), session!.user.role)
  if (!ownerId) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  const doctor = await getDoctorProfile(ownerId)
  const db = getDb()
  const accessCondition = doctor?.email
    ? or(eq(orders.submittedBy, ownerId), and(isNull(orders.submittedBy), eq(orders.email, doctor.email)))
    : eq(orders.submittedBy, ownerId)
  const [order] = await db.select().from(orders).where(and(eq(orders.id, id), accessCondition)).limit(1)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  const zipBuffer = await buildOrderZip(order)
  return new NextResponse(new Uint8Array(zipBuffer), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="order_${order.orderNo}.zip"` } })
}
