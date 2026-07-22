import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { requirePortalUser } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { orderDrafts } from '@/lib/db/schema'
import { getOrderOwnerId } from '@/lib/portal/access'

type DraftPayload = {
  id?: number
  values?: Record<string, unknown>
  fileUrls?: Record<string, string>
}

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

export async function GET() {
  const { ownerId, error } = await getOwner()
  if (error) return error

  const drafts = await getDb()
    .select()
    .from(orderDrafts)
    .where(eq(orderDrafts.ownerId, ownerId!))
    .orderBy(desc(orderDrafts.updatedAt))

  return NextResponse.json({ drafts })
}

export async function POST(request: Request) {
  const { ownerId, error } = await getOwner()
  if (error) return error

  let body: DraftPayload
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid draft data' }, { status: 400 })
  }

  if (!body.values || typeof body.values !== 'object' || Array.isArray(body.values)) {
    return NextResponse.json({ error: 'Draft form data is required' }, { status: 400 })
  }

  const fileUrls = body.fileUrls && typeof body.fileUrls === 'object' && !Array.isArray(body.fileUrls)
    ? body.fileUrls
    : {}
  const draftId = typeof body.id === 'number' && Number.isInteger(body.id) && body.id > 0 ? body.id : null
  if (body.id !== undefined && !draftId) {
    return NextResponse.json({ error: 'Invalid draft ID' }, { status: 400 })
  }
  const db = getDb()

  if (draftId) {
    const [draft] = await db
      .update(orderDrafts)
      .set({ formData: body.values, fileUrls, updatedAt: new Date() })
      .where(and(eq(orderDrafts.id, draftId), eq(orderDrafts.ownerId, ownerId!)))
      .returning()

    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    return NextResponse.json({ success: true, draft })
  }

  const [draft] = await db
    .insert(orderDrafts)
    .values({ ownerId: ownerId!, formData: body.values, fileUrls })
    .returning()

  return NextResponse.json({ success: true, draft }, { status: 201 })
}
