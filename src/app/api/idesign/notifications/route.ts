import { and, count, desc, eq, isNull } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { idesignNotifications } from '@/lib/db/schema'
import { canViewIDesign } from '@/lib/idesign/access'
import { markIDesignNotificationRead } from '@/lib/idesign/notifications'

export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canViewIDesign(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const userId = Number(session!.user.id)
  const [notifications, unread] = await Promise.all([
    getDb().select().from(idesignNotifications).where(eq(idesignNotifications.userId, userId)).orderBy(desc(idesignNotifications.createdAt)).limit(30),
    getDb().select({ count: count() }).from(idesignNotifications).where(and(eq(idesignNotifications.userId, userId), isNull(idesignNotifications.readAt))),
  ])
  return NextResponse.json({ notifications, unreadCount: unread[0]?.count ?? 0 })
}

export async function PATCH(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  const body = await request.json().catch(() => null) as { id?: unknown } | null
  const notificationId = Number(body?.id)
  if (!Number.isInteger(notificationId)) return NextResponse.json({ error: 'Invalid notification' }, { status: 400 })
  await markIDesignNotificationRead(notificationId, Number(session!.user.id))
  return NextResponse.json({ success: true })
}
