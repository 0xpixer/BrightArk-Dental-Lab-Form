import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyBatchChange,
  batchCount,
  batchLabel,
  batchOptions,
  canViewAlignerProduction,
  isProductionReminderDue,
  isValidBatch,
  nextProductionDue,
  parseTotalStages,
  RETAINER_BATCH,
  updateAlignerProductionSchema,
} from './production'

test('batch count is total stages divided by 10, rounded up', () => {
  assert.equal(batchCount(null), 0)
  assert.equal(batchCount(0), 0)
  assert.equal(batchCount(1), 1)
  assert.equal(batchCount(10), 1)
  assert.equal(batchCount(11), 2)
  assert.equal(batchCount(30), 3)
  assert.equal(batchCount(31), 4)
})

test('batch options list every batch of 10 then the retainer', () => {
  assert.deepEqual(batchOptions(25).map((option) => option.label), ['1-10', '11-20', '21-25', 'Retainer'])
  assert.deepEqual(batchOptions(30).map((option) => option.value), [1, 2, 3, RETAINER_BATCH])
  // Unknown total still offers batch 1-10 so a delivery can be recorded.
  assert.deepEqual(batchOptions(null).map((option) => option.label), ['1-10', 'Retainer'])
})

test('batch labels', () => {
  assert.equal(batchLabel(1, 25), '1-10')
  assert.equal(batchLabel(3, 25), '21-25')
  assert.equal(batchLabel(3, null), '21-30')
  assert.equal(batchLabel(RETAINER_BATCH, 25), 'Retainer')
})

test('valid batches depend on total stages', () => {
  assert.equal(isValidBatch(1, null), true)
  assert.equal(isValidBatch(2, null), false)
  assert.equal(isValidBatch(3, 25), true)
  assert.equal(isValidBatch(4, 25), false)
  assert.equal(isValidBatch(RETAINER_BATCH, 25), true)
  assert.equal(isValidBatch(0, 25), false)
})

test('next production is due 80 days after the current batch was delivered', () => {
  assert.equal(nextProductionDue(1, '2026-01-01'), '2026-03-22')
  assert.equal(nextProductionDue(2, '2026-11-20'), '2027-02-08')
  assert.equal(nextProductionDue(1, null), null)
  assert.equal(nextProductionDue(null, '2026-01-01'), null)
  assert.equal(nextProductionDue(RETAINER_BATCH, '2026-01-01'), null)
  // The final batch is delivered: nothing left to produce.
  assert.equal(nextProductionDue(1, '2026-01-01', 10), null)
  assert.equal(nextProductionDue(1, '2026-01-01', 8), null)
  assert.equal(nextProductionDue(3, '2026-01-01', 25), null)
  assert.equal(nextProductionDue(1, '2026-01-01', 11), '2026-03-22')
  assert.equal(nextProductionDue(2, '2026-01-01', 25), '2026-03-22')
})

test('a reminder is due once per batch, on or after the due date', () => {
  const row = { deliveredBatch: 1, batchDeliveredOn: '2026-01-01', notifiedBatch: null }
  assert.equal(isProductionReminderDue(row, '2026-03-21'), false)
  assert.equal(isProductionReminderDue(row, '2026-03-22'), true)
  assert.equal(isProductionReminderDue(row, '2026-05-01'), true)
  assert.equal(isProductionReminderDue({ ...row, notifiedBatch: 1 }, '2026-05-01'), false)
  // Advancing to the next batch arms a new reminder.
  assert.equal(isProductionReminderDue({ deliveredBatch: 2, batchDeliveredOn: '2026-03-25', notifiedBatch: 1 }, '2026-06-13'), true)
  assert.equal(isProductionReminderDue({ ...row, totalStages: 10 }, '2026-05-01'), false)
  assert.equal(isProductionReminderDue({ ...row, totalStages: 24 }, '2026-05-01'), true)
  assert.equal(isProductionReminderDue({ deliveredBatch: RETAINER_BATCH, batchDeliveredOn: '2026-01-01', notifiedBatch: 3 }, '2027-01-01'), false)
})

test('changing the batch records today; keeping it keeps the date', () => {
  const current = { deliveredBatch: 1, batchDeliveredOn: '2026-01-01' }
  assert.deepEqual(applyBatchChange(current, 2, '2026-03-25'), { deliveredBatch: 2, batchDeliveredOn: '2026-03-25' })
  assert.deepEqual(applyBatchChange(current, 1, '2026-03-25'), { deliveredBatch: 1, batchDeliveredOn: '2026-01-01' })
  assert.deepEqual(applyBatchChange({ deliveredBatch: null, batchDeliveredOn: null }, 1, '2026-03-25'), { deliveredBatch: 1, batchDeliveredOn: '2026-03-25' })
})

test('total stages parse from imported text', () => {
  assert.equal(parseTotalStages('24'), 24)
  assert.equal(parseTotalStages(' 24 steps'), 24)
  assert.equal(parseTotalStages(''), null)
  assert.equal(parseTotalStages('abc'), null)
  assert.equal(parseTotalStages(0), null)
  assert.equal(parseTotalStages(null), null)
})

test('only superadmin and sales can view the tracker', () => {
  assert.equal(canViewAlignerProduction('superadmin'), true)
  assert.equal(canViewAlignerProduction('sales'), true)
  assert.equal(canViewAlignerProduction('sales_director'), true)
  assert.equal(canViewAlignerProduction('admin'), false)
  assert.equal(canViewAlignerProduction('treatment_designer'), false)
  assert.equal(canViewAlignerProduction('doctor'), false)
})

test('update payload accepts one field at a time', () => {
  assert.equal(updateAlignerProductionSchema.safeParse({ totalStages: 24 }).success, true)
  assert.equal(updateAlignerProductionSchema.safeParse({ totalStages: 0 }).success, false)
  assert.equal(updateAlignerProductionSchema.safeParse({ deliveredBatch: 2 }).success, true)
  assert.equal(updateAlignerProductionSchema.safeParse({ batchDeliveredOn: '2026-02-30x' }).success, false)
  assert.equal(updateAlignerProductionSchema.safeParse({ batchDeliveredOn: '2026-02-03' }).success, true)
})
