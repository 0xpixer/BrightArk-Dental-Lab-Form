import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers } from '@/lib/db/schema'
import { requirePortalUser } from '@/lib/admin/session'
import { getDoctorProfile, getOrderOwnerId } from '@/lib/portal/access'

export async function GET() {
  const { session, error } = await requirePortalUser()
  if (error) return error

  const userId = parseInt(session!.user.id, 10)
  const ownerId = await getOrderOwnerId(userId, session!.user.role)
  if (!ownerId) return NextResponse.json({ error: 'Clinic staff is not linked to a doctor' }, { status: 403 })

  const profile = await getDoctorProfile(ownerId)
  if (!profile) return NextResponse.json({ error: 'Doctor profile not found' }, { status: 404 })

  return NextResponse.json({ profile, editable: session!.user.role === 'doctor' })
}

export async function PATCH(request: Request) {
  const { session, error } = await requirePortalUser()
  if (error) return error
  if (session!.user.role !== 'doctor') {
    return NextResponse.json({ error: 'Clinic staff cannot edit the doctor profile' }, { status: 403 })
  }

  const body = await request.json()
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
  const clinicName = typeof body.clinicName === 'string' ? body.clinicName.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!fullName || !clinicName || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Name, clinic, and a valid email are required' }, { status: 400 })
  }

  const db = getDb()
  const userId = parseInt(session!.user.id, 10)
  const [updated] = await db
    .update(adminUsers)
    .set({
      fullName,
      clinicName,
      email,
      username: email,
      phone: typeof body.phone === 'string' ? body.phone.trim() || null : null,
      address: typeof body.address === 'string' ? body.address.trim() || null : null,
    })
    .where(eq(adminUsers.id, userId))
    .returning({
      id: adminUsers.id,
      fullName: adminUsers.fullName,
      clinicName: adminUsers.clinicName,
      email: adminUsers.email,
      phone: adminUsers.phone,
      address: adminUsers.address,
    })

  return NextResponse.json({ success: true, profile: updated })
}
