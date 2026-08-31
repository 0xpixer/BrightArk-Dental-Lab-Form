import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers, doctorClinics } from '@/lib/db/schema'
import { requirePortalUser } from '@/lib/admin/session'
import { getDoctorProfile, getOrderOwnerId } from '@/lib/portal/access'
import { normalizeActorName } from '@/lib/admin/accountIdentity'

type ClinicInput = { id?: number; name: string; address: string }

function parseClinics(value: unknown): ClinicInput[] | null {
  if (!Array.isArray(value)) return null

  const clinics = value.map((clinic) => ({
    id: typeof clinic?.id === 'number' ? clinic.id : undefined,
    name: typeof clinic?.name === 'string' ? clinic.name.trim() : '',
    address: typeof clinic?.address === 'string' ? clinic.address.trim() : '',
  }))

  return clinics.length > 0 && clinics.every((clinic) => clinic.name && clinic.address) ? clinics : null
}

export async function GET() {
  const { session, error } = await requirePortalUser()
  if (error) return error

  const userId = parseInt(session!.user.id, 10)
  const ownerId = await getOrderOwnerId(userId, session!.user.role)
  if (!ownerId) return NextResponse.json({ error: 'Clinic staff is not linked to a doctor' }, { status: 403 })

  const db = getDb()
  const [profile, [account]] = await Promise.all([
    getDoctorProfile(ownerId),
    db.select({ fullName: adminUsers.fullName, username: adminUsers.username }).from(adminUsers).where(eq(adminUsers.id, userId)).limit(1),
  ])
  if (!profile) return NextResponse.json({ error: 'Doctor profile not found' }, { status: 404 })
  if (!account) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  return NextResponse.json({
    profile: { ...profile, actorName: account.fullName || account.username },
    editable: session!.user.role === 'doctor',
    clinicEditable: true,
  })
}

export async function PATCH(request: Request) {
  const { session, error } = await requirePortalUser()
  if (error) return error

  const userId = parseInt(session!.user.id, 10)
  const ownerId = await getOrderOwnerId(userId, session!.user.role)
  if (!ownerId) return NextResponse.json({ error: 'Clinic staff is not linked to a doctor' }, { status: 403 })

  const body = await request.json()
  const parsedActorName = normalizeActorName(session!.user.role === 'doctor' ? body.fullName : body.actorName)
  if (parsedActorName.error) return NextResponse.json({ error: parsedActorName.error }, { status: 400 })

  const clinics = parseClinics(body.clinics)
  if (!clinics) {
    return NextResponse.json({ error: 'Add at least one clinic with its delivery address' }, { status: 400 })
  }

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (session!.user.role === 'doctor' && (!fullName || !/^\S+@\S+\.\S+$/.test(email))) {
    return NextResponse.json({ error: 'Name and a valid email are required' }, { status: 400 })
  }

  const db = getDb()
  const existingClinics = await db
    .select({ id: doctorClinics.id })
    .from(doctorClinics)
    .where(eq(doctorClinics.doctorId, ownerId))
  const existingIds = new Set(existingClinics.map((clinic) => clinic.id))
  const retainedIds = new Set<number>()

  for (const clinic of clinics) {
    if (clinic.id && existingIds.has(clinic.id)) {
      retainedIds.add(clinic.id)
      await db
        .update(doctorClinics)
        .set({ name: clinic.name, address: clinic.address })
        .where(and(eq(doctorClinics.id, clinic.id), eq(doctorClinics.doctorId, ownerId)))
    } else {
      await db.insert(doctorClinics).values({ doctorId: ownerId, name: clinic.name, address: clinic.address })
    }
  }

  for (const clinic of existingClinics) {
    if (!retainedIds.has(clinic.id)) {
      await db.delete(doctorClinics).where(and(eq(doctorClinics.id, clinic.id), eq(doctorClinics.doctorId, ownerId)))
    }
  }

  const primaryClinic = clinics[0]
  if (session!.user.role === 'doctor') {
    await db
      .update(adminUsers)
      .set({
        fullName: parsedActorName.value,
        email,
        username: email,
        phone: typeof body.phone === 'string' ? body.phone.trim() || null : null,
        clinicName: primaryClinic.name,
        address: primaryClinic.address,
      })
      .where(eq(adminUsers.id, ownerId))
  } else {
    await Promise.all([
      db
        .update(adminUsers)
        .set({ clinicName: primaryClinic.name, address: primaryClinic.address })
        .where(eq(adminUsers.id, ownerId)),
      db
        .update(adminUsers)
        .set({ fullName: parsedActorName.value })
        .where(eq(adminUsers.id, userId)),
    ])
  }

  const profile = await getDoctorProfile(ownerId)
  return NextResponse.json({ success: true, profile: profile && { ...profile, actorName: parsedActorName.value } })
}
