import { eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/session'
import { isAdminRole, isPortalRole, isSalesRole } from '@/lib/admin/roles'
import { getDb } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { parseNewOrderFileUrls } from '@/lib/orderFiles'
import { getAccessiblePortalOrder } from '@/lib/portal/orderAccess'
import { getAccessibleDashboardOrder } from '@/lib/sales/access'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const incomingFiles = parseNewOrderFileUrls(body?.fileUrls)
  if (!incomingFiles) {
    return NextResponse.json({ error: 'No valid files provided' }, { status: 400 })
  }

  const userId = Number(session!.user.id)
  const role = session!.user.role
  const db = getDb()
  const order = isAdminRole(role)
    ? (await db.select().from(orders).where(eq(orders.id, id)).limit(1))[0]
    : isSalesRole(role)
      ? await getAccessibleDashboardOrder(id, userId, role)
    : isPortalRole(role)
      ? await getAccessiblePortalOrder(id, userId, role)
      : null

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const existingFiles = (order.fileUrls as Record<string, string> | null) ?? {}
  if (Object.keys(incomingFiles).some((slotId) => slotId in existingFiles)) {
    return NextResponse.json({ error: 'One or more file slots already exist. Please try again.' }, { status: 409 })
  }

  const serializedFiles = JSON.stringify(incomingFiles)
  const [updated] = await db
    .update(orders)
    .set({ fileUrls: sql`coalesce(${orders.fileUrls}, '{}'::jsonb) || ${serializedFiles}::jsonb` })
    .where(eq(orders.id, id))
    .returning({ fileUrls: orders.fileUrls })

  if (!updated) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  return NextResponse.json({ success: true, fileUrls: updated.fileUrls })
}
