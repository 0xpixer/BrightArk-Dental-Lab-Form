import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers, doctorClinics } from '@/lib/db/schema'

export async function getOrderOwnerId(userId: number, role: string): Promise<number | null> {
  if (role === 'doctor') return userId
  if (role !== 'clinic_staff') return null

  const db = getDb()
  const [staffAccount] = await db
    .select({ linkedDoctorId: adminUsers.linkedDoctorId })
    .from(adminUsers)
    .where(eq(adminUsers.id, userId))
    .limit(1)

  return staffAccount?.linkedDoctorId ?? null
}

export async function getDoctorProfile(ownerId: number) {
  const db = getDb()
  const [doctor] = await db
    .select({
      id: adminUsers.id,
      fullName: adminUsers.fullName,
      clinicName: adminUsers.clinicName,
      email: adminUsers.email,
      phone: adminUsers.phone,
      address: adminUsers.address,
    })
    .from(adminUsers)
    .where(eq(adminUsers.id, ownerId))
    .limit(1)

  if (!doctor) return null

  const clinics = await db
    .select({
      id: doctorClinics.id,
      name: doctorClinics.name,
      address: doctorClinics.address,
    })
    .from(doctorClinics)
    .where(eq(doctorClinics.doctorId, ownerId))
    .orderBy(doctorClinics.id)

  return { ...doctor, clinics }
}
