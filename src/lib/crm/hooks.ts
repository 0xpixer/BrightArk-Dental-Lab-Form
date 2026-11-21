import type { SQL } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { crmOrphanPairsQuery, insertAssignedCrmQuery, linkCrmByEmailQuery, mergeCrmPairQueries } from './queries'

// CRM hooks called from registration (also from auth.ts) and assignment changes.
// Kept free of session/auth imports to avoid an import cycle with '@/auth'.

/** Runs one statement and returns its rows. Injectable so tests can use an in-memory database. */
export type CrmExecutor = (query: SQL) => Promise<unknown[]>

const defaultExecutor: CrmExecutor = async (query) => (await getDb().execute(query)).rows

/**
 * When a doctor moves to another sales rep, folds the old rep's record into the new rep's one, so a
 * reassignment never leaves a duplicate. Runs over every doctor (cheap; usually finds nothing).
 */
export async function mergeOrphanedCrmRows(execute: CrmExecutor = defaultExecutor) {
  let merged = 0
  // A doctor moved more than once can leave several orphans; each pass folds one per current record.
  for (let pass = 0; pass < 5; pass += 1) {
    const pairs = await execute(crmOrphanPairsQuery()) as { orphanId: number; keepId: number; salesId: number }[]
    const usedKeep = new Set<number>()
    let progressed = false
    for (const pair of pairs) {
      if (usedKeep.has(pair.keepId)) continue
      usedKeep.add(pair.keepId)
      for (const query of mergeCrmPairQueries(pair.orphanId, pair.keepId, pair.salesId)) await execute(query)
      merged += 1
      progressed = true
    }
    if (!progressed) break
  }
  return merged
}

/** Back-fills the CRM for these sales accounts (or everyone): link by email, add assigned doctors, fold moved ones. */
export async function syncCrm(salesIds?: number[], execute: CrmExecutor = defaultExecutor) {
  await execute(linkCrmByEmailQuery(salesIds ? { salesIds } : {}))
  await execute(insertAssignedCrmQuery(salesIds ? { salesIds } : {}))
  await mergeOrphanedCrmRows(execute)
}

/**
 * Registration hook: links any sales-added rows with the new doctor's email to the account and
 * adds rows for any existing assignments. Never throws; registration must not fail because of the CRM.
 */
export async function onDoctorRegistered(doctorId: number, execute: CrmExecutor = defaultExecutor) {
  try {
    await execute(linkCrmByEmailQuery({ doctorAccountId: doctorId }))
    await execute(insertAssignedCrmQuery({ doctorIds: [doctorId] }))
  } catch (error) {
    console.error('CRM link after registration failed', error instanceof Error ? error.message : error)
  }
}

/** Assignment hook: run after sales↔doctor assignments change. Never throws. */
export async function onSalesAssignmentsChanged(salesIds: number[], execute: CrmExecutor = defaultExecutor) {
  try {
    await syncCrm(salesIds, execute)
  } catch (error) {
    console.error('CRM sync after assignment change failed', error instanceof Error ? error.message : error)
  }
}
