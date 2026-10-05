import { eq, sql, type SQL } from 'drizzle-orm'
import { idesignCases, idesignOrders } from '@/lib/db/schema'
import { isPortalRole, isSalesRole } from '@/lib/admin/roles'
import { getOrderOwnerId } from '@/lib/portal/access'

export async function getIDesignAccessCondition(userId: number, role: string): Promise<SQL | undefined> {
  if (role === 'superadmin' || role === 'admin') return undefined
  if (isSalesRole(role)) return eq(idesignOrders.salesAccountId, userId)
  if (isPortalRole(role)) {
    const ownerId = await getOrderOwnerId(userId, role)
    return ownerId ? eq(idesignOrders.doctorAccountId, ownerId) : sql`false`
  }
  return sql`false`
}

export async function getIDesignCaseAccessCondition(userId: number, role: string): Promise<SQL | undefined> {
  if (role === 'superadmin' || role === 'admin') return undefined
  if (isSalesRole(role)) return eq(idesignCases.salesAccountId, userId)
  if (isPortalRole(role)) {
    const ownerId = await getOrderOwnerId(userId, role)
    return ownerId ? eq(idesignCases.doctorAccountId, ownerId) : sql`false`
  }
  return sql`false`
}

export function canViewIDesign(role: string) {
  return role === 'superadmin' || role === 'admin' || isSalesRole(role) || isPortalRole(role)
}

export function canManageIDesignPlans(role: string) {
  return role === 'superadmin' || role === 'admin'
}

export function canApproveIDesignPlans(role: string) {
  return role === 'doctor' || role === 'clinic_staff'
}
