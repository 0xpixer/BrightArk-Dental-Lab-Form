import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers } from '@/lib/db/schema'
import { requireSuperadmin } from '@/lib/admin/session'
import { isAdminRole } from '@/lib/admin/roles'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { session, error } = await requireSuperadmin()
  if (error) return error

  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 })
  }

  const currentUserId = parseInt(session!.user.id, 10)
  if (id === currentUserId) {
    return NextResponse.json({ error: 'Cannot modify your own account via this endpoint' }, { status: 400 })
  }

  const body = await request.json()
  const db = getDb()
  const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1)

  if (!existing) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const updateData: Partial<typeof adminUsers.$inferInsert> = {}

  if (body.isActive !== undefined) {
    updateData.isActive = Boolean(body.isActive)
  }

  if (body.role !== undefined) {
    if (!isAdminRole(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    updateData.role = body.role
  }

  if (body.password) {
    if (body.password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    updateData.passwordHash = await bcrypt.hash(body.password, 12)
  }

  const nextRole = updateData.role ?? existing.role
  const nextIsActive = updateData.isActive ?? existing.isActive

  if (existing.role === 'superadmin' && existing.isActive && (nextRole !== 'superadmin' || !nextIsActive)) {
    const superadmins = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(and(eq(adminUsers.role, 'superadmin'), eq(adminUsers.isActive, true)))

    const activeSuperadminCount = superadmins.length
    if (activeSuperadminCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove or deactivate the last active superadmin' },
        { status: 400 },
      )
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const [updated] = await db
    .update(adminUsers)
    .set(updateData)
    .where(eq(adminUsers.id, id))
    .returning({
      id: adminUsers.id,
      username: adminUsers.username,
      role: adminUsers.role,
      isActive: adminUsers.isActive,
    })

  if (!updated) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    account: updated,
    temporaryPassword: body.password ?? undefined,
  })
}
