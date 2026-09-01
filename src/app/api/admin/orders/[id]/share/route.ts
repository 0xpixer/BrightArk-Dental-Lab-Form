import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { sharedLinks } from '@/lib/db/schema'
import { requireDashboardUser } from '@/lib/admin/session'
import { getAccessibleDashboardOrder } from '@/lib/sales/access'

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { session, error } = await requireDashboardUser()
  if (error) return error

  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const expiryDays = body.expiryDays as number | null | undefined

  const db = getDb()
  const order = await getAccessibleDashboardOrder(id, Number(session!.user.id), session!.user.role)

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const token = crypto.randomUUID()
  let expiresAt: Date | null = null

  if (expiryDays === 7) {
    expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  } else if (expiryDays === 30) {
    expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  }

  const [link] = await db
    .insert(sharedLinks)
    .values({
      orderId: order.id,
      token,
      createdBy: parseInt(session!.user.id, 10),
      expiresAt,
    })
    .returning()

  const baseUrl = process.env.NEXTAUTH_URL ?? request.headers.get('origin') ?? ''
  const shareUrl = `${baseUrl}/admin/share/${token}`

  return NextResponse.json({
    success: true,
    token,
    shareUrl,
    expiresAt: link.expiresAt,
    downloadCount: link.downloadCount,
  })
}
