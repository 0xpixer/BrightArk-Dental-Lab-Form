import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateEstimatedFinish, calculateTreatmentSteps, recalculateRemainingSteps, suggestedChangeDate } from './schedule'

test('treatment schedule supports a different duration for every step', () => {
  const steps = calculateTreatmentSteps('2026-10-01', [7, 10, 14])
  assert.deepEqual(steps, [
    { stepNumber: 1, durationDays: 7, suggestedStartDate: '2026-10-01', suggestedEndDate: '2026-10-07' },
    { stepNumber: 2, durationDays: 10, suggestedStartDate: '2026-10-08', suggestedEndDate: '2026-10-17' },
    { stepNumber: 3, durationDays: 14, suggestedStartDate: '2026-10-18', suggestedEndDate: '2026-10-31' },
  ])
  assert.equal(calculateEstimatedFinish('2026-10-01', [7, 10, 14]), '2026-10-31')
  assert.equal(suggestedChangeDate(steps, 1), '2026-10-08')
})

test('an actual step change keeps history and moves future suggestions', () => {
  const original = calculateTreatmentSteps('2026-10-01', [10, 10, 7])
  const updated = recalculateRemainingSteps(original, 2, '2026-10-13')
  assert.equal(updated[0].suggestedStartDate, '2026-10-01')
  assert.equal(updated[1].suggestedStartDate, '2026-10-13')
  assert.equal(updated[2].suggestedStartDate, '2026-10-23')
  assert.equal(updated[2].suggestedEndDate, '2026-10-29')
})
