import { eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { parseProductionFileUrls } from '@/lib/orderFiles'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin()
  if (error) return error

  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const incomingFiles = parseProductionFileUrls(body?.fileUrls)
  if (!incomingFiles) {
    return NextResponse.json({ error: 'No valid production files provided' }, { status: 400 })
  }

  const db = getDb()
  const [order] = await db.select({ productionFileUrls: orders.productionFileUrls }).from(orders).where(eq(orders.id, id)).limit(1)
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const existingFiles = (order.productionFileUrls as Record<string, string> | null) ?? {}
  if (Object.keys(incomingFiles).some((slotId) => slotId in existingFiles)) {
    return NextResponse.json({ error: 'One or more production file slots already exist. Please try again.' }, { status: 409 })
  }

  const serializedFiles = JSON.stringify(incomingFiles)
  const [updated] = await db
    .update(orders)
    .set({ productionFileUrls: sql`coalesce(${orders.productionFileUrls}, '{}'::jsonb) || ${serializedFiles}::jsonb` })
    .where(eq(orders.id, id))
    .returning({ productionFileUrls: orders.productionFileUrls })

  if (!updated) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  return NextResponse.json({ success: true, productionFileUrls: updated.productionFileUrls })
}
