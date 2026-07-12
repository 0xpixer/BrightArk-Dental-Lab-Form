import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { eq, or } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers } from '@/lib/db/schema'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const clinicName = typeof body.clinicName === 'string' ? body.clinicName.trim() : ''

    if (!fullName || !clinicName || !email || !password) {
      return NextResponse.json({ error: 'Name, clinic, email, and password are required' }, { status: 400 })
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }

    const db = getDb()
    const [existing] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(or(eq(adminUsers.email, email), eq(adminUsers.username, email)))
      .limit(1)

    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    await db.insert(adminUsers).values({
      username: email,
      email,
      passwordHash,
      fullName,
      clinicName,
      phone: typeof body.phone === 'string' ? body.phone.trim() || null : null,
      address: typeof body.address === 'string' ? body.address.trim() || null : null,
      role: 'doctor',
      isActive: true,
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Doctor registration failed:', error)
    return NextResponse.json({ error: 'Unable to create the account' }, { status: 500 })
  }
}
