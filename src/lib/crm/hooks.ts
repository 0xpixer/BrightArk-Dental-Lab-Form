import type { SQL } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { insertAssignedCrmQuery, linkCrmByEmailQuery } from './queries'

// CRM hooks called from registration (also from auth.ts) and assignment changes.
// Kept free of session/auth imports to avoid an import cycle with '@/auth'.

/** Runs one statement. Injectable so tests can use an in-memory database. */
export type CrmExecutor = (query: SQL) => Promise<unknown>

const defaultExecutor: CrmExecutor = (query) => getDb().execute(query)

/** Back-fills the CRM for these sales accounts (or everyone): link by email, then add assigned doctors. */
export async function syncCrm(salesIds?: number[], execute: CrmExecutor = defaultExecutor) {
  await execute(linkCrmByEmailQuery(salesIds ? { salesIds } : {}))
  await execute(insertAssignedCrmQuery(salesIds ? { salesIds } : {}))
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
