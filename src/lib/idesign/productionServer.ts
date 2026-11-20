import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { alignerProduction } from '@/lib/db/schema'
import { dateInTimezone } from './schedule'
import { PRODUCTION_TIMEZONE } from './production'

export function productionToday(now = new Date()) {
  return dateInTimezone(now, PRODUCTION_TIMEZONE)
}

/**
 * A clear aligner order reached Delivered: record batch 1-10 as delivered today, unless a batch
 * was already recorded (a later batch, or a date an admin entered by hand stays as it is).
 * Never throws, so a status change cannot fail because of the tracker.
 */
export async function recordFirstBatchDelivered(caseIds: number[], now = new Date()) {
  if (caseIds.length === 0) return
  const today = productionToday(now)
  try {
    await getDb().insert(alignerProduction)
      .values(caseIds.map((caseId) => ({ caseId, deliveredBatch: 1, batchDeliveredOn: today, updatedAt: now })))
      .onConflictDoUpdate({
        target: alignerProduction.caseId,
        set: {
          deliveredBatch: sql`coalesce(${alignerProduction.deliveredBatch}, 1)`,
          batchDeliveredOn: today,
          updatedAt: now,
        },
        setWhere: or(
          isNull(alignerProduction.deliveredBatch),
          and(eq(alignerProduction.deliveredBatch, 1), isNull(alignerProduction.batchDeliveredOn)),
        ),
      })
  } catch (error) {
    console.error('Unable to record the first aligner batch delivery', error)
  }
}
