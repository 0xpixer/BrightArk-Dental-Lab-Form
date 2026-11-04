import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateAutomaticTreatmentProgress, calculateEstimatedFinish, calculateTreatmentSteps, recalculateRemainingSteps, suggestedChangeDate } from './schedule'

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

test('calculates the current treatment stage automatically from scheduled dates', () => {
  const stages = calculateTreatmentSteps('2026-10-01', [10, 10, 10])
  const beforeStart = calculateAutomaticTreatmentProgress(stages, '2026-09-20')
  const active = calculateAutomaticTreatmentProgress(stages, '2026-10-15')
  const completed = calculateAutomaticTreatmentProgress(stages, '2026-11-01')

  assert.equal(beforeStart?.currentStage, 1)
  assert.equal(active?.currentStage, 2)
  assert.equal(active?.nextSuggestedChange, '2026-10-21')
  assert.equal(active?.stageStatuses.get(1), 'completed')
  assert.equal(active?.stageStatuses.get(2), 'current')
  assert.equal(completed?.currentStage, 3)
  assert.equal(completed?.status, 'completed')
})

test('uses the highest started stage when historic schedule dates overlap', () => {
  const progress = calculateAutomaticTreatmentProgress([
    { stepNumber: 1, suggestedStartDate: '2026-08-29', suggestedEndDate: '2026-09-07' },
    { stepNumber: 2, suggestedStartDate: '2026-11-04', suggestedEndDate: '2026-11-13' },
    { stepNumber: 3, suggestedStartDate: '2026-11-04', suggestedEndDate: '2026-11-13' },
    { stepNumber: 4, suggestedStartDate: '2026-11-04', suggestedEndDate: '2026-11-13' },
    { stepNumber: 5, suggestedStartDate: '2026-11-04', suggestedEndDate: '2026-11-13' },
    { stepNumber: 6, suggestedStartDate: '2026-11-14', suggestedEndDate: '2026-11-23' },
  ], '2026-11-04')

  assert.equal(progress?.currentStage, 5)
  assert.equal(progress?.nextSuggestedChange, '2026-11-14')
})
