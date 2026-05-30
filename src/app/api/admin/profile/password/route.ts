import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers } from '@/lib/db/schema'
import { requireSession } from '@/lib/admin/session'

export async function PATCH(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  const body = await request.json()
  const { currentPassword, newPassword, confirmPassword } = body

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: 'All password fields are required' }, { status: 400 })
  }

  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'New passwords do not match' }, { status: 400 })
  }

  if (newPassword.length < 8 || !/\d/.test(newPassword)) {
    return NextResponse.json(
      { error: 'New password must be at least 8 characters and contain a number' },
      { status: 400 },
    )
  }

  const db = getDb()
  const userId = parseInt(session!.user.id, 10)

  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.id, userId)).limit(1)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)

  await db.update(adminUsers).set({ passwordHash }).where(eq(adminUsers.id, userId))

  return NextResponse.json({ success: true, message: 'Password updated successfully' })
}
