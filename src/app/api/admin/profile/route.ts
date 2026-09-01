import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireDashboardUser } from '@/lib/admin/session'
import { normalizeActorName } from '@/lib/admin/accountIdentity'
import { getDb } from '@/lib/db/client'
import { adminUsers } from '@/lib/db/schema'

export async function GET() {
  const { session, error } = await requireDashboardUser()
  if (error) return error

  const userId = Number(session!.user.id)
  const [profile] = await getDb()
    .select({ username: adminUsers.username, role: adminUsers.role, fullName: adminUsers.fullName })
    .from(adminUsers)
    .where(eq(adminUsers.id, userId))
    .limit(1)

  if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json({ profile: { ...profile, fullName: profile.fullName || profile.username } })
}

export async function PATCH(request: Request) {
  const { session, error } = await requireDashboardUser()
  if (error) return error

  const parsedName = normalizeActorName((await request.json().catch(() => null))?.fullName)
  if (parsedName.error) return NextResponse.json({ error: parsedName.error }, { status: 400 })

  const userId = Number(session!.user.id)
  const [updated] = await getDb()
    .update(adminUsers)
    .set({ fullName: parsedName.value })
    .where(eq(adminUsers.id, userId))
    .returning({ username: adminUsers.username, role: adminUsers.role, fullName: adminUsers.fullName })

  if (!updated) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json({ success: true, profile: updated })
}
