import { asc, inArray, type SQL } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { salesDoctorAssignments } from '@/lib/db/schema'
import { onSalesAssignmentsChanged } from '@/lib/crm/hooks'
import { findRelationshipIssues, type OrderSalesLink, type RelationshipIssue } from './issues'
import { alignCaseSalesQuery, alignOrderSalesQuery, assignDoctorSalesQuery, clearDoctorSalesQuery, orderSalesLinksQuery } from './queries'

/** Runs one statement and returns its rows. Injectable so tests can use an in-memory database. */
export type RelationshipExecutor = <T = Record<string, unknown>>(query: SQL) => Promise<T[]>

const defaultExecutor: RelationshipExecutor = async <T,>(query: SQL) => (await getDb().execute(query)).rows as T[]

/** Each doctor's sales rep (the earliest assignment), for the given doctors. */
export async function getDoctorSalesIds(doctorIds: number[]) {
  const wanted = [...new Set(doctorIds)].filter((id) => Number.isSafeInteger(id) && id > 0)
  const result = new Map<number, number>()
  if (!wanted.length) return result
  const rows = await getDb().select({ doctorId: salesDoctorAssignments.doctorId, salesId: salesDoctorAssignments.salesId })
    .from(salesDoctorAssignments).where(inArray(salesDoctorAssignments.doctorId, wanted))
    .orderBy(asc(salesDoctorAssignments.createdAt), asc(salesDoctorAssignments.salesId))
  for (const row of rows) if (!result.has(row.doctorId)) result.set(row.doctorId, row.salesId)
  return result
}

export async function getDoctorSalesId(doctorId: number | null) {
  if (!doctorId) return null
  return (await getDoctorSalesIds([doctorId])).get(doctorId) ?? null
}

/** Moves existing clear aligner orders and Finance rows to each doctor's current sales rep. */
export async function alignDoctorOrders(doctorIds: number[], actorId: number | null, execute: RelationshipExecutor = defaultExecutor) {
  const [cases, orders] = [await execute(alignCaseSalesQuery(doctorIds)), await execute(alignOrderSalesQuery(doctorIds, actorId))]
  return cases.length + orders.length
}

/**
 * Sets the one sales rep of these doctors (null unassigns). With moveOrders, their existing orders
 * follow; the CRM gains a row for the new rep either way.
 */
export async function setDoctorSales(doctorIds: number[], salesId: number | null, actorId: number | null, options: { moveOrders: boolean }, execute: RelationshipExecutor = defaultExecutor) {
  await execute(clearDoctorSalesQuery(doctorIds, salesId))
  if (salesId) await execute(assignDoctorSalesQuery(doctorIds, salesId, actorId))
  const moved = salesId && options.moveOrders ? await alignDoctorOrders(doctorIds, actorId, execute) : 0
  if (salesId) await onSalesAssignmentsChanged([salesId], execute)
  return { moved }
}

/**
 * Gives a doctor a sales rep when they have none (an order was filed under that rep).
 * Never replaces an existing rep. Returns true when it assigned one.
 */
export async function adoptOrderSales(doctorId: number | null, salesId: number | null, actorId: number | null, execute: RelationshipExecutor = defaultExecutor) {
  if (!doctorId || !salesId) return false
  const created = await execute(assignDoctorSalesQuery([doctorId], salesId, actorId, true))
  if (!created.length) return false
  await onSalesAssignmentsChanged([salesId], execute)
  return true
}

export async function loadOrderSalesLinks(execute: RelationshipExecutor = defaultExecutor) {
  return execute<OrderSalesLink>(orderSalesLinksQuery())
}

/** Applies the suggested fix for each issue: assign the doctor, or move the orders to the doctor's rep. */
export async function fixRelationshipIssues(issues: RelationshipIssue[], actorId: number | null, execute: RelationshipExecutor = defaultExecutor) {
  let fixed = 0
  const touchedSales = new Set<number>()
  for (const issue of issues) {
    if (issue.kind === 'unassigned_with_orders') {
      const created = await execute(assignDoctorSalesQuery([issue.doctorId], issue.salesId, actorId, true))
      if (created.length) touchedSales.add(issue.salesId)
    }
  }
  const doctorIds = [...new Set(issues.map((issue) => issue.doctorId))]
  if (doctorIds.length) fixed = await alignDoctorOrders(doctorIds, actorId, execute)
  if (touchedSales.size) await onSalesAssignmentsChanged([...touchedSales], execute)
  return { fixed, doctors: doctorIds.length }
}

export { findRelationshipIssues }
