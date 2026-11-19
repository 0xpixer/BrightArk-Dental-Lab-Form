// Doctor ↔ Sales relationships. The doctor account's assignment is the source of truth;
// clear aligner orders and Finance rows follow it. Pure helpers, so they are unit tested.

/** Orders (cases or Finance/imported rows) of one doctor filed under one sales value. */
export interface OrderSalesLink {
  doctorId: number
  salesId: number | null
  count: number
}

export type RelationshipIssue =
  /** No sales rep on the account, but orders name one: assign the doctor to it. */
  | { kind: 'unassigned_with_orders'; doctorId: number; salesId: number; orderCount: number }
  /** The doctor has a sales rep, but some orders have none: fill them in. */
  | { kind: 'orders_missing_sales'; doctorId: number; salesId: number; orderCount: number }
  /** Some orders name another sales rep than the doctor's: move them to the doctor's rep. */
  | { kind: 'orders_other_sales'; doctorId: number; salesId: number; otherSalesIds: number[]; orderCount: number }

/**
 * @param doctorSales the doctor's sales rep (null when unassigned) for every doctor account
 * @param links order counts per doctor and sales value
 */
export function findRelationshipIssues(doctorSales: Map<number, number | null>, links: OrderSalesLink[]): RelationshipIssue[] {
  const byDoctor = new Map<number, OrderSalesLink[]>()
  for (const link of links) {
    if (!doctorSales.has(link.doctorId) || link.count <= 0) continue
    const list = byDoctor.get(link.doctorId) ?? []
    list.push(link)
    byDoctor.set(link.doctorId, list)
  }
  const issues: RelationshipIssue[] = []
  for (const [doctorId, doctorLinks] of byDoctor) {
    const salesId = doctorSales.get(doctorId) ?? null
    if (salesId === null) {
      // Suggest the sales rep named on most of the doctor's orders (lowest id breaks ties).
      const named = doctorLinks.filter((link) => link.salesId !== null)
        .sort((a, b) => b.count - a.count || a.salesId! - b.salesId!)
      if (named.length) issues.push({ kind: 'unassigned_with_orders', doctorId, salesId: named[0].salesId!, orderCount: named.reduce((sum, link) => sum + link.count, 0) })
      continue
    }
    const missing = doctorLinks.filter((link) => link.salesId === null).reduce((sum, link) => sum + link.count, 0)
    if (missing) issues.push({ kind: 'orders_missing_sales', doctorId, salesId, orderCount: missing })
    const other = doctorLinks.filter((link) => link.salesId !== null && link.salesId !== salesId)
    if (other.length) {
      issues.push({
        kind: 'orders_other_sales', doctorId, salesId,
        otherSalesIds: [...new Set(other.map((link) => link.salesId!))].sort((a, b) => a - b),
        orderCount: other.reduce((sum, link) => sum + link.count, 0),
      })
    }
  }
  return issues.sort((a, b) => a.doctorId - b.doctorId || a.kind.localeCompare(b.kind))
}

export interface SalesCandidate { id: number; name: string; username: string; email: string | null }

function normalize(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}@.]+/gu, ' ').trim()
}

/**
 * Best sales account for the free-text rep a doctor typed at sign-up, or null when it is
 * empty or ambiguous. Only a suggestion: an admin still confirms the assignment.
 */
export function matchSalesReferral(referral: string | null | undefined, candidates: SalesCandidate[]): number | null {
  const hint = normalize(referral ?? '')
  if (hint.length < 2) return null
  const exact = candidates.filter((candidate) => [candidate.name, candidate.username, candidate.email ?? '']
    .some((value) => value && normalize(value) === hint))
  if (exact.length === 1) return exact[0].id
  const hintWords = hint.split(' ').filter((word) => word.length >= 2 && !word.includes('@'))
  if (!hintWords.length) return null
  const scored = candidates.map((candidate) => {
    const words = new Set(normalize(`${candidate.name} ${candidate.username.split('@')[0]}`).split(/[ .]+/))
    return { id: candidate.id, score: hintWords.filter((word) => words.has(word)).length }
  }).filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score)
  if (!scored.length || (scored[1] && scored[1].score === scored[0].score)) return null
  return scored[0].id
}
