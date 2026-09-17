import { and, eq, sql, type SQL } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers, orders, salesDoctorAssignments } from '@/lib/db/schema'
import { isAdminRole, isSalesRole } from '@/lib/admin/roles'
import { doctorOrderScope } from '@/lib/portal/orderScope'

async function getAssignedDoctors(salesId: number, activeOnly: boolean) {
  return getDb()
    .select({
      id: adminUsers.id,
      fullName: adminUsers.fullName,
      email: adminUsers.email,
      clinicName: adminUsers.clinicName,
      address: adminUsers.address,
    })
    .from(salesDoctorAssignments)
    .innerJoin(adminUsers, eq(adminUsers.id, salesDoctorAssignments.doctorId))
    .where(and(
      eq(salesDoctorAssignments.salesId, salesId),
      eq(adminUsers.role, 'doctor'),
      activeOnly ? eq(adminUsers.isActive, true) : undefined,
    ))
}

export async function getSalesDoctors(salesId: number) {
  return getAssignedDoctors(salesId, true)
}

export async function getSalesDoctorIds(salesId: number) {
  const rows = await getSalesDoctors(salesId)
  return rows.map((doctor) => doctor.id)
}

export async function isDoctorAssignedToSales(salesId: number, doctorId: number) {
  const [assignment] = await getDb()
    .select({ doctorId: salesDoctorAssignments.doctorId })
    .from(salesDoctorAssignments)
    .where(and(eq(salesDoctorAssignments.salesId, salesId), eq(salesDoctorAssignments.doctorId, doctorId)))
    .limit(1)
  return Boolean(assignment)
}

export async function getSalesOrderAccessCondition(salesId: number): Promise<SQL> {
  const doctors = await getAssignedDoctors(salesId, false)
  return doctorOrderScope(doctors.map((doctor) => doctor.id))
}

export async function getDashboardOrderAccessCondition(userId: number, role: string): Promise<SQL | undefined> {
  if (isAdminRole(role)) return undefined
  if (isSalesRole(role)) return getSalesOrderAccessCondition(userId)
  return sql`false`
}

export async function getAccessibleDashboardOrder(orderId: number, userId: number, role: string) {
  const accessCondition = await getDashboardOrderAccessCondition(userId, role)
  const [order] = await getDb()
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), accessCondition))
    .limit(1)
  return order ?? null
}
