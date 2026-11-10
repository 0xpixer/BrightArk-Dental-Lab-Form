import { and, eq, inArray, sql, type SQL } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers, orders, salesDirectorAssignments, salesDoctorAssignments } from '@/lib/db/schema'
import { isAdminRole, isSalesRole } from '@/lib/admin/roles'
import { doctorOrderScope } from '@/lib/portal/orderScope'

/**
 * Sales account IDs whose scope this user inherits: the user itself plus, for a
 * Sales Director, every active Sales account assigned to them.
 */
export async function getSalesScopeIds(userId: number): Promise<number[]> {
  const rows = await getDb()
    .select({ salesId: salesDirectorAssignments.salesId })
    .from(salesDirectorAssignments)
    .innerJoin(adminUsers, eq(adminUsers.id, salesDirectorAssignments.directorId))
    .where(and(eq(salesDirectorAssignments.directorId, userId), eq(adminUsers.role, 'sales_director')))
  return [...new Set([userId, ...rows.map((row) => row.salesId)])]
}

async function getAssignedDoctors(userId: number, activeOnly: boolean) {
  const salesIds = await getSalesScopeIds(userId)
  return getDb()
    .selectDistinct({
      id: adminUsers.id,
      fullName: adminUsers.fullName,
      email: adminUsers.email,
      clinicName: adminUsers.clinicName,
      address: adminUsers.address,
    })
    .from(salesDoctorAssignments)
    .innerJoin(adminUsers, eq(adminUsers.id, salesDoctorAssignments.doctorId))
    .where(and(
      inArray(salesDoctorAssignments.salesId, salesIds),
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
  const salesIds = await getSalesScopeIds(salesId)
  const [assignment] = await getDb()
    .select({ doctorId: salesDoctorAssignments.doctorId })
    .from(salesDoctorAssignments)
    .where(and(inArray(salesDoctorAssignments.salesId, salesIds), eq(salesDoctorAssignments.doctorId, doctorId)))
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
