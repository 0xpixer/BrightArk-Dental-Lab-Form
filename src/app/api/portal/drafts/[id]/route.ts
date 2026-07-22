import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requirePortalUser } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { orderDrafts } from '@/lib/db/schema'
import { getOrderOwnerId } from '@/lib/portal/access'

async function getOwner() {
  const { session, error } = await requirePortalUser()
  if (error) return { ownerId: null, error }

  const ownerId = await getOrderOwnerId(parseInt(session!.user.id, 10), session!.user.role)
  if (!ownerId) {
    return {
      ownerId: null,
      error: NextResponse.json({ error: 'Clinic staff is not linked to a doctor' }, { status: 403 }),
    }
  }

  return { ownerId, error: null }
}

function parseId(value: string) {
  const id = parseInt(value, 10)
  return Number.isInteger(id) && id > 0 ? id : null
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { ownerId, error } = await getOwner()
  if (error) return error
  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'Invalid draft ID' }, { status: 400 })

  const [draft] = await getDb()
    .select()
    .from(orderDrafts)
    .where(and(eq(orderDrafts.id, id), eq(orderDrafts.ownerId, ownerId!)))
    .limit(1)

  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  return NextResponse.json({ draft })
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const { ownerId, error } = await getOwner()
  if (error) return error
  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'Invalid draft ID' }, { status: 400 })

  const [deleted] = await getDb()
    .delete(orderDrafts)
    .where(and(eq(orderDrafts.id, id), eq(orderDrafts.ownerId, ownerId!)))
    .returning({ id: orderDrafts.id })

  if (!deleted) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  return NextResponse.json({ success: true })
}
