import { and, eq, isNull, or, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { alignerProduction, idesignOrders, idesignTreatmentCourses } from '@/lib/db/schema'
import { dateInTimezone } from './schedule'
import { PRODUCTION_INTERVAL_DAYS, PRODUCTION_TIMEZONE, RETAINER_BATCH, STAGES_PER_BATCH } from './production'

/**
 * Total stages as the tracker uses it: the saved total, else the wear schedule's, else the imported
 * spreadsheet's leading number (mirrors parseTotalStages). Needs idesignTreatmentCourses and idesignOrders joined.
 */
export const effectiveTotalStagesSql = sql<number | null>`coalesce(${alignerProduction.totalStages}, ${idesignTreatmentCourses.totalSteps},
  case when trim(${idesignOrders.totalSteps}) ~ '^[0-9]{1,3}([^0-9]|$)' then nullif(substring(trim(${idesignOrders.totalSteps}) from '^[0-9]+')::int, 0) end)`

/** SQL twin of nextProductionDue: delivered date + 80 days, null for the retainer or once the final batch is delivered. */
export const nextProductionDueSql = sql<string | null>`case when ${alignerProduction.deliveredBatch} is not null
  and ${alignerProduction.deliveredBatch} <> ${RETAINER_BATCH}::int
  and (${effectiveTotalStagesSql} is null or ${alignerProduction.deliveredBatch} < ceil(${effectiveTotalStagesSql}::numeric / ${STAGES_PER_BATCH}::int))
  then (${alignerProduction.batchDeliveredOn} + ${PRODUCTION_INTERVAL_DAYS}::int)::date end`

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
