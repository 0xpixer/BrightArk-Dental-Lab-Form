import { inArray, sql, type SQL } from 'drizzle-orm'
import { orders } from '@/lib/db/schema'

export function doctorOrderScope(doctorIds: number[]): SQL {
  if (doctorIds.length === 0 || doctorIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    return sql`false`
  }
  return inArray(orders.submittedBy, doctorIds)
}
