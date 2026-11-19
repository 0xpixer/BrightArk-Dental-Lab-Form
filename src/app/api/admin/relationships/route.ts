import { NextResponse } from 'next/server'
import { asc, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers, salesDirectorAssignments, salesDoctorAssignments } from '@/lib/db/schema'
import { requireAdmin } from '@/lib/admin/session'
import { canViewAccount } from '@/lib/admin/accountIdentity'
import { findRelationshipIssues, matchSalesReferral } from '@/lib/relationships/issues'
import { loadOrderSalesLinks } from '@/lib/relationships/server'

/** Who serves whom: directors → sales → doctors → clinic staff, plus unassigned doctors and mismatches. */
export async function GET() {
  const { session, error } = await requireAdmin()
  if (error) return error
  const db = getDb()
  const [users, doctorAssignments, directorAssignments, links] = await Promise.all([
    db.select({
      id: adminUsers.id, username: adminUsers.username, email: adminUsers.email, fullName: adminUsers.fullName,
      clinicName: adminUsers.clinicName, country: adminUsers.country, city: adminUsers.city, role: adminUsers.role,
      linkedDoctorId: adminUsers.linkedDoctorId, isActive: adminUsers.isActive, createdAt: adminUsers.createdAt,
      salesReferral: adminUsers.salesReferral,
    }).from(adminUsers)
      .where(inArray(adminUsers.role, ['doctor', 'clinic_staff', 'sales', 'sales_director']))
      .orderBy(asc(adminUsers.fullName), asc(adminUsers.username)),
    db.select().from(salesDoctorAssignments).orderBy(asc(salesDoctorAssignments.createdAt), asc(salesDoctorAssignments.salesId)),
    db.select().from(salesDirectorAssignments),
    loadOrderSalesLinks(),
  ])
  const visible = users.filter((user) => canViewAccount(session!.user.username, user.username))
  const name = (user: { fullName: string | null; username: string }) => user.fullName || user.username
  const salesUsers = visible.filter((user) => user.role === 'sales' || user.role === 'sales_director')
  const doctors = visible.filter((user) => user.role === 'doctor')

  const doctorSales = new Map<number, number | null>(doctors.map((doctor) => [doctor.id, null]))
  for (const assignment of doctorAssignments) {
    if (doctorSales.get(assignment.doctorId) === null) doctorSales.set(assignment.doctorId, assignment.salesId)
  }
  const orderCounts = new Map<number, number>()
  for (const link of links) orderCounts.set(link.doctorId, (orderCounts.get(link.doctorId) ?? 0) + link.count)
  const issues = findRelationshipIssues(doctorSales, links)
  const suggestionFromOrders = new Map(issues.filter((issue) => issue.kind === 'unassigned_with_orders').map((issue) => [issue.doctorId, issue.salesId]))
  const candidates = salesUsers.filter((user) => user.isActive).map((user) => ({ id: user.id, name: name(user), username: user.username, email: user.email }))

  return NextResponse.json({
    directors: visible.filter((user) => user.role === 'sales_director').map((user) => ({
      id: user.id, name: name(user), isActive: user.isActive,
      salesIds: directorAssignments.filter((assignment) => assignment.directorId === user.id).map((assignment) => assignment.salesId),
    })),
    sales: salesUsers.map((user) => ({ id: user.id, name: name(user), role: user.role, isActive: user.isActive, country: user.country })),
    doctors: doctors.map((doctor) => {
      const salesId = doctorSales.get(doctor.id) ?? null
      return {
        id: doctor.id, name: name(doctor), email: doctor.email, clinicName: doctor.clinicName, country: doctor.country, city: doctor.city,
        isActive: doctor.isActive, createdAt: doctor.createdAt, salesId, salesReferral: doctor.salesReferral,
        extraSalesIds: doctorAssignments.filter((assignment) => assignment.doctorId === doctor.id && assignment.salesId !== salesId).map((assignment) => assignment.salesId),
        suggestedSalesId: salesId ? null : suggestionFromOrders.get(doctor.id) ?? matchSalesReferral(doctor.salesReferral, candidates),
        suggestionSource: salesId ? null : suggestionFromOrders.has(doctor.id) ? 'orders' : doctor.salesReferral ? 'signup' : null,
        orderCount: orderCounts.get(doctor.id) ?? 0,
        staff: visible.filter((user) => user.role === 'clinic_staff' && user.linkedDoctorId === doctor.id).map((user) => ({ id: user.id, name: name(user) })),
      }
    }),
    issues,
    canEdit: session!.user.role === 'superadmin',
  })
}
