import { z } from 'zod'
import { isSalesRole } from '@/lib/admin/roles'
import { addDaysToDate } from './schedule'

/** Aligners are produced and delivered in batches of this many stages. */
export const STAGES_PER_BATCH = 10
/** The next batch should go into production this many days after the current batch was delivered. */
export const PRODUCTION_INTERVAL_DAYS = 80
/** Stored deliveredBatch value for the retainer; above every real batch so "later" compares naturally. */
export const RETAINER_BATCH = 1000
export const MAX_TOTAL_STAGES = 200
/** Production dates follow the lab's local calendar. */
export const PRODUCTION_TIMEZONE = 'Asia/Jakarta'

/** Only Superadmin and Sales (incl. Sales Directors) see the production tracker. */
export function canViewAlignerProduction(role: string) {
  return role === 'superadmin' || isSalesRole(role)
}

export function batchCount(totalStages: number | null | undefined) {
  return totalStages && totalStages > 0 ? Math.ceil(totalStages / STAGES_PER_BATCH) : 0
}

/** "1-10", "11-20", … with the last batch ending at the total (e.g. "21-25"); "Retainer" for the retainer. */
export function batchLabel(batch: number, totalStages: number | null | undefined) {
  if (batch === RETAINER_BATCH) return 'Retainer'
  const start = (batch - 1) * STAGES_PER_BATCH + 1
  const fullEnd = batch * STAGES_PER_BATCH
  const end = totalStages && totalStages >= start ? Math.min(fullEnd, totalStages) : fullEnd
  return `${start}-${end}`
}

/** Dropdown options: one per batch of 10 stages, then the retainer. Batch 1-10 is always offered. */
export function batchOptions(totalStages: number | null | undefined) {
  const count = Math.max(1, batchCount(totalStages))
  return [
    ...Array.from({ length: count }, (_, index) => ({ value: index + 1, label: batchLabel(index + 1, totalStages) })),
    { value: RETAINER_BATCH, label: 'Retainer' },
  ]
}

export function isValidBatch(batch: number, totalStages: number | null | undefined) {
  return batch === RETAINER_BATCH || (Number.isInteger(batch) && batch >= 1 && batch <= Math.max(1, batchCount(totalStages)))
}

/** Next production due date: the current batch's delivered date + 80 days. None once the retainer is delivered. */
export function nextProductionDue(deliveredBatch: number | null | undefined, batchDeliveredOn: string | null | undefined) {
  if (!deliveredBatch || deliveredBatch === RETAINER_BATCH || !batchDeliveredOn) return null
  return addDaysToDate(batchDeliveredOn, PRODUCTION_INTERVAL_DAYS)
}

/** Due for a reminder: the due date has arrived and no reminder went out for this batch yet. */
export function isProductionReminderDue(
  row: { deliveredBatch: number | null; batchDeliveredOn: string | null; notifiedBatch: number | null },
  today: string,
) {
  const due = nextProductionDue(row.deliveredBatch, row.batchDeliveredOn)
  return due !== null && due <= today && row.notifiedBatch !== row.deliveredBatch
}

/** Moving the dropdown to a different batch records that batch as delivered today. */
export function applyBatchChange(
  current: { deliveredBatch: number | null; batchDeliveredOn: string | null },
  nextBatch: number,
  today: string,
) {
  if (current.deliveredBatch === nextBatch) return { deliveredBatch: nextBatch, batchDeliveredOn: current.batchDeliveredOn }
  return { deliveredBatch: nextBatch, batchDeliveredOn: today }
}

/** Total stages from an imported spreadsheet value ("24", "24 steps"); null when it is not a usable number. */
export function parseTotalStages(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value).trim(), 10)
  return Number.isInteger(parsed) && parsed > 0 && parsed <= MAX_TOTAL_STAGES ? parsed : null
}

const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Invalid date')

export const updateAlignerProductionSchema = z.union([
  z.object({ totalStages: z.number().int().min(1).max(MAX_TOTAL_STAGES).nullable() }),
  z.object({ deliveredBatch: z.number().int().min(1).nullable() }),
  z.object({ batchDeliveredOn: dateValue.nullable() }),
])
