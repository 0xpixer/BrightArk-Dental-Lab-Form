import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { requirePortalUser } from '@/lib/admin/session'
import { getOrderOwnerId } from '@/lib/portal/access'

export async function GET() {
  const { session, error } = await requirePortalUser()
  if (error) return error
  const ownerId = await getOrderOwnerId(parseInt(session!.user.id, 10), session!.user.role)
  if (!ownerId) return NextResponse.json({ error: 'Clinic staff is not linked to a doctor' }, { status: 403 })

  const db = getDb()
  const rows = await db.select().from(orders).where(eq(orders.submittedBy, ownerId)).orderBy(desc(orders.createdAt))
  return NextResponse.json({ orders: rows })
}
