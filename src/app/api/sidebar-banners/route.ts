import { asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { sidebarBanners } from '@/lib/db/schema'

export async function GET() {
  const { error } = await requireSession()
  if (error) return error

  const banners = await getDb()
    .select({
      id: sidebarBanners.id,
      imageUrl: sidebarBanners.imageUrl,
      linkUrl: sidebarBanners.linkUrl,
      altText: sidebarBanners.altText,
    })
    .from(sidebarBanners)
    .where(eq(sidebarBanners.isActive, true))
    .orderBy(asc(sidebarBanners.position), asc(sidebarBanners.id))
    .limit(3)

  return NextResponse.json({ banners })
}
