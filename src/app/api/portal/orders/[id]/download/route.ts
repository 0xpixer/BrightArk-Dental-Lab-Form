import { NextResponse } from 'next/server'
import { requirePortalUser } from '@/lib/admin/session'
import { getAccessiblePortalOrder } from '@/lib/portal/orderAccess'
import { buildOrderZip } from '@/lib/admin/buildOrderZip'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requirePortalUser()
  if (error) return error
  const id = parseInt(params.id, 10)
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
  const order = await getAccessiblePortalOrder(id, Number(session!.user.id), session!.user.role)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  const zipBuffer = await buildOrderZip(order, request.url)
  return new NextResponse(new Uint8Array(zipBuffer), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="order_${order.orderNo}.zip"` } })
}
