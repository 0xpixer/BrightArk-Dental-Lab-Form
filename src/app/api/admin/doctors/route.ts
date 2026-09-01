import { and, eq, inArray } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireDashboardUser } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { adminUsers, doctorClinics } from '@/lib/db/schema'
import { isSalesRole } from '@/lib/admin/roles'
import { getSalesDoctorIds } from '@/lib/sales/access'

export async function GET() {
  const { session, error } = await requireDashboardUser()
  if (error) return error

  const db = getDb()
  const salesDoctorIds = isSalesRole(session!.user.role) ? await getSalesDoctorIds(Number(session!.user.id)) : null
  if (salesDoctorIds?.length === 0) return NextResponse.json({ doctors: [] })
  const doctors = await db
    .select({
      id: adminUsers.id,
      fullName: adminUsers.fullName,
      email: adminUsers.email,
      clinicName: adminUsers.clinicName,
      address: adminUsers.address,
    })
    .from(adminUsers)
    .where(and(
      eq(adminUsers.role, 'doctor'),
      eq(adminUsers.isActive, true),
      salesDoctorIds ? inArray(adminUsers.id, salesDoctorIds) : undefined,
    ))

  const clinics = doctors.length > 0
    ? await db
      .select({ id: doctorClinics.id, doctorId: doctorClinics.doctorId, name: doctorClinics.name, address: doctorClinics.address })
      .from(doctorClinics)
      .where(inArray(doctorClinics.doctorId, doctors.map((doctor) => doctor.id)))
    : []

  return NextResponse.json({
    doctors: doctors.map((doctor) => ({
      ...doctor,
      clinics: clinics.filter((clinic) => clinic.doctorId === doctor.id).map(({ doctorId: _doctorId, ...clinic }) => clinic),
    })),
  })
}
