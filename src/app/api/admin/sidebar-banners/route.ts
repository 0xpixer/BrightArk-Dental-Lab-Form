import { del } from '@vercel/blob'
import { asc, eq, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { sidebarBanners } from '@/lib/db/schema'

const MAX_BANNERS = 3

export async function GET() {
  const { error } = await requireAdmin()
  if (error) return error

  const banners = await getDb().select().from(sidebarBanners)
    .orderBy(asc(sidebarBanners.position), asc(sidebarBanners.id))
  return NextResponse.json({ banners, maxBanners: MAX_BANNERS })
}

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await readBody(request)
  if (body instanceof NextResponse) return body
  const imageUrl = validHttpUrl(body.imageUrl)
  const linkUrl = optionalHttpUrl(body.linkUrl)
  if (!imageUrl) return NextResponse.json({ error: 'A valid banner image is required.' }, { status: 400 })
  if (linkUrl === undefined) return NextResponse.json({ error: 'The destination link must start with http:// or https://.' }, { status: 400 })

  const db = getDb()
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(sidebarBanners)
  if (count >= MAX_BANNERS) {
    return NextResponse.json({ error: `A maximum of ${MAX_BANNERS} banners is allowed.` }, { status: 409 })
  }

  const [created] = await db.insert(sidebarBanners).values({
    imageUrl,
    linkUrl,
    altText: cleanAltText(body.altText),
    position: count,
    isActive: body.isActive !== false,
  }).returning()
  return NextResponse.json({ banner: created }, { status: 201 })
}

export async function PATCH(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await readBody(request)
  if (body instanceof NextResponse) return body
  const id = Number(body.id)
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid banner.' }, { status: 400 })

  const linkUrl = optionalHttpUrl(body.linkUrl)
  if (linkUrl === undefined) return NextResponse.json({ error: 'The destination link must start with http:// or https://.' }, { status: 400 })
  const imageUrl = body.imageUrl === undefined ? undefined : validHttpUrl(body.imageUrl)
  if (body.imageUrl !== undefined && !imageUrl) return NextResponse.json({ error: 'A valid banner image is required.' }, { status: 400 })

  const db = getDb()
  const [existing] = await db.select().from(sidebarBanners).where(eq(sidebarBanners.id, id)).limit(1)
  if (!existing) return NextResponse.json({ error: 'Banner not found.' }, { status: 404 })

  const [updated] = await db.update(sidebarBanners).set({
    ...(imageUrl ? { imageUrl } : {}),
    linkUrl,
    altText: cleanAltText(body.altText),
    isActive: body.isActive !== false,
    position: Number.isInteger(body.position) ? Math.max(0, Number(body.position)) : existing.position,
    updatedAt: new Date(),
  }).where(eq(sidebarBanners.id, id)).returning()

  if (imageUrl && existing.imageUrl !== imageUrl) await removeBlob(existing.imageUrl)
  return NextResponse.json({ banner: updated })
}

export async function DELETE(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await readBody(request)
  if (body instanceof NextResponse) return body
  const id = Number(body.id)
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid banner.' }, { status: 400 })

  const db = getDb()
  const [deleted] = await db.delete(sidebarBanners).where(eq(sidebarBanners.id, id)).returning()
  if (!deleted) return NextResponse.json({ error: 'Banner not found.' }, { status: 404 })
  await removeBlob(deleted.imageUrl)
  return NextResponse.json({ success: true })
}

async function readBody(request: Request): Promise<Record<string, unknown> | NextResponse> {
  try {
    return await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
}

function validHttpUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
  } catch { return null }
}

function optionalHttpUrl(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null
  return validHttpUrl(value) ?? undefined
}

function cleanAltText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : 'BrightArk promotion'
}

async function removeBlob(url: string) {
  if (!url.includes('vercel-storage.com')) return
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN || process.env.UPLOADS_READ_WRITE_TOKEN
    if (token) await del(url, { token })
  } catch (error) {
    console.error('Unable to delete sidebar banner blob:', error)
  }
}
