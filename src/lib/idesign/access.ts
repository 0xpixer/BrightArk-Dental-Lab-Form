import { eq, sql, type SQL } from 'drizzle-orm'
import { idesignCases, idesignOrders } from '@/lib/db/schema'
import { isAdminRole, isDesignerRole, isPortalRole, isSalesRole } from '@/lib/admin/roles'
import { getOrderOwnerId } from '@/lib/portal/access'

export async function getIDesignAccessCondition(userId: number, role: string): Promise<SQL | undefined> {
  if (role === 'superadmin' || role === 'admin' || isDesignerRole(role)) return undefined
  if (isSalesRole(role)) return eq(idesignOrders.salesAccountId, userId)
  if (isPortalRole(role)) {
    const ownerId = await getOrderOwnerId(userId, role)
    return ownerId ? eq(idesignOrders.doctorAccountId, ownerId) : sql`false`
  }
  return sql`false`
}

export async function getIDesignCaseAccessCondition(userId: number, role: string): Promise<SQL | undefined> {
  if (role === 'superadmin' || role === 'admin' || isDesignerRole(role)) return undefined
  if (isSalesRole(role)) return eq(idesignCases.salesAccountId, userId)
  if (isPortalRole(role)) {
    const ownerId = await getOrderOwnerId(userId, role)
    return ownerId ? eq(idesignCases.doctorAccountId, ownerId) : sql`false`
  }
  return sql`false`
}

export function canViewIDesign(role: string) {
  return role === 'superadmin' || role === 'admin' || isDesignerRole(role) || isSalesRole(role) || isPortalRole(role)
}

export function canManageIDesignPlans(role: string) {
  return role === 'superadmin' || role === 'admin'
}

export function canPublishIDesignPlans(role: string) {
  return canManageIDesignPlans(role) || isDesignerRole(role)
}

export function canCreateIDesignCases(role: string) {
  return canViewIDesign(role) && !isDesignerRole(role)
}

export function canApproveIDesignPlans(role: string) {
  return role === 'doctor' || role === 'clinic_staff'
}

export function canManageIDesignSchedule(role: string) {
  return role === 'superadmin' || role === 'admin' || role === 'doctor' || role === 'clinic_staff'
}

export function canAssignIDesignOrders(role: string) {
  return role === 'superadmin' || role === 'admin'
}

export function canDeleteIDesignOrders(role: string) {
  return isAdminRole(role)
}

export function canEditIDesignCaseInformation(role: string) {
  return isAdminRole(role)
}

export function canDownloadIDesignCaseFiles(role: string) {
  return isAdminRole(role) || isDesignerRole(role)
}
