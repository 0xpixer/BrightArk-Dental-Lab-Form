import { eq, sql, type SQL } from 'drizzle-orm'
import { idesignOrders } from '@/lib/db/schema'
import { isPortalRole, isSalesRole } from '@/lib/admin/roles'
import { getOrderOwnerId } from '@/lib/portal/access'

export async function getIDesignAccessCondition(userId: number, role: string): Promise<SQL | undefined> {
  if (role === 'superadmin') return undefined
  if (isSalesRole(role)) return eq(idesignOrders.salesAccountId, userId)
  if (isPortalRole(role)) {
    const ownerId = await getOrderOwnerId(userId, role)
    return ownerId ? eq(idesignOrders.doctorAccountId, ownerId) : sql`false`
  }
  return sql`false`
}

export function canViewIDesign(role: string) {
  return role === 'superadmin' || isSalesRole(role) || isPortalRole(role)
}
