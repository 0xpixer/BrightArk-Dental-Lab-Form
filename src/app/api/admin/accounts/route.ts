import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { and, eq, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers } from '@/lib/db/schema'
import { requireSuperadmin } from '@/lib/admin/session'
import { isAccountRole } from '@/lib/admin/roles'

export async function GET() {
  const { error } = await requireSuperadmin()
  if (error) return error

  const db = getDb()
  const users = await db.select().from(adminUsers).orderBy(desc(adminUsers.createdAt))
  const usernameById = new Map(users.map((u) => [u.id, u.username]))

  return NextResponse.json({
    accounts: users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      fullName: u.fullName,
      clinicName: u.clinicName,
      role: u.role,
      linkedDoctorId: u.linkedDoctorId,
      isActive: u.isActive,
      createdBy: u.createdBy,
      createdByUsername: u.createdBy ? usernameById.get(u.createdBy) ?? null : null,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
    })),
    doctors: users.filter((u) => u.role === 'doctor').map((u) => ({ id: u.id, name: u.fullName ?? u.username })),
  })
}

export async function POST(request: Request) {
  const { session, error } = await requireSuperadmin()
  if (error) return error

  const body = await request.json()
  const { username, password, role, linkedDoctorId } = body

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
  }

  if (!isAccountRole(role)) {
    return NextResponse.json({ error: 'A valid role is required' }, { status: 400 })
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return NextResponse.json(
      { error: 'Username must be alphanumeric with underscores only' },
      { status: 400 },
    )
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const db = getDb()
  let linkedDoctor: number | null = null
  if (role === 'clinic_staff') {
    linkedDoctor = Number(linkedDoctorId)
    const [doctor] = await db.select({ id: adminUsers.id }).from(adminUsers).where(and(eq(adminUsers.id, linkedDoctor), eq(adminUsers.role, 'doctor'))).limit(1)
    if (!doctor) return NextResponse.json({ error: 'Clinic staff must be linked to a doctor' }, { status: 400 })
  }
  const existing = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.username, username))
    .limit(1)

  if (existing.length > 0) {
    return NextResponse.json({ error: 'Username already exists' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const [created] = await db
    .insert(adminUsers)
    .values({
      username,
      passwordHash,
      role,
      linkedDoctorId: linkedDoctor,
      createdBy: parseInt(session!.user.id, 10),
      isActive: true,
    })
    .returning({
      id: adminUsers.id,
      username: adminUsers.username,
      role: adminUsers.role,
      linkedDoctorId: adminUsers.linkedDoctorId,
    })

  return NextResponse.json({ success: true, account: created }, { status: 201 })
}
