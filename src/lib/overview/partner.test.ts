import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAlignerOverview, buildDoctorSummaries, buildFinanceSummary, buildLabExtras, type PartnerAlignerCaseInput, type PartnerLabOrderInput } from './partner'

const now = new Date('2026-11-14T08:00:00Z')

function alignerCase(id: number, latestProgress: string, extra: Partial<PartnerAlignerCaseInput> = {}): PartnerAlignerCaseInput {
  return { id, orderNo: `IDA-${id}`, patientName: `Patient ${id}`, latestProgress, createdOn: '2026-11-02', updatedAt: `2026-11-0${id % 9 + 1}T00:00:00.000Z`, doctorAccountId: 1, doctorName: 'Dr A', hasCourse: false, ...extra }
}

test('aligner overview groups action items and counts the pipeline', () => {
  const cases = [
    alignerCase(1, 'Awaiting Approval'),
    alignerCase(2, 'Awaiting Approval'),
    alignerCase(3, 'Entering Info', { createdOn: '2026-08-10' }),
    alignerCase(4, 'Approved'),
    alignerCase(5, 'In Production', { hasCourse: true }),
    alignerCase(6, 'Completed', { createdOn: '2026-06-01' }),
  ]
  const overview = buildAlignerOverview(cases, [], now)
  assert.equal(overview.totals.awaitingApproval, 2)
  assert.equal(overview.totals.active, 5)
  assert.equal(overview.totals.completed, 1)
  assert.equal(overview.totals.newThisMonth, 4)
  assert.deepEqual(overview.needsSchedule.map((item) => item.id), [4])
  assert.equal(overview.enteringInfoCount, 1)
  assert.equal(overview.pipeline['Awaiting Approval'], 2)
  assert.equal(overview.trend.length, 6)
  assert.equal(overview.trend.at(-1)?.count, 4)
  // Oldest approval request first, so nothing waits too long.
  assert.deepEqual(overview.awaitingApproval.map((item) => item.id), [1, 2])
})

test('wear progress flags a stage change within seven days', () => {
  const cases = [alignerCase(1, 'Delivered', { hasCourse: true }), alignerCase(2, 'Delivered', { hasCourse: true })]
  const stages = (start: string) => [
    { stepNumber: 1, suggestedStartDate: start, suggestedEndDate: '2026-11-17' },
    { stepNumber: 2, suggestedStartDate: '2026-11-18', suggestedEndDate: '2026-11-27' },
  ]
  const overview = buildAlignerOverview(cases, [
    { caseId: 1, totalSteps: 2, status: 'active', today: '2026-11-14', stages: stages('2026-11-08') },
    { caseId: 2, totalSteps: 2, status: 'active', today: '2026-12-30', stages: stages('2026-11-08') },
  ], now)
  assert.equal(overview.wearing.length, 1, 'finished courses drop out')
  assert.equal(overview.wearing[0].currentStage, 1)
  assert.equal(overview.wearing[0].daysToNextChange, 4)
  assert.equal(overview.wearing[0].dueSoon, true)
  assert.equal(overview.wearDueSoonCount, 1)
})

test('finance summary totals unpaid and overdue amounts per currency', () => {
  const summary = buildFinanceSummary([
    { paymentStatus: 'Unpaid', invoiceDate: '2026-10-01', dueDate: null, originalPrice: '1000', discount: '10', totalAmount: null, currency: 'SGD' },
    { paymentStatus: 'Unpaid', invoiceDate: '2026-11-10', dueDate: null, originalPrice: '500', discount: null, totalAmount: null, currency: 'SGD' },
    { paymentStatus: 'Unpaid', invoiceDate: null, dueDate: '2026-11-01', originalPrice: null, discount: null, totalAmount: '2,000,000', currency: 'IDR' },
    { paymentStatus: 'Paid', invoiceDate: '2026-01-01', dueDate: null, originalPrice: '999', discount: null, totalAmount: null, currency: 'SGD' },
  ], 30, '2026-11-14')
  assert.equal(summary.unpaidCount, 3)
  assert.equal(summary.overdueCount, 2)
  assert.deepEqual(summary.unpaid, [{ currency: 'IDR', amount: 2_000_000 }, { currency: 'SGD', amount: 1400 }])
  assert.deepEqual(summary.overdue, [{ currency: 'IDR', amount: 2_000_000 }, { currency: 'SGD', amount: 900 }])
})

function labOrder(id: number, status: string, treatmentType: string | null, submittedBy = 1): PartnerLabOrderInput {
  return { id, orderNo: `LAB-${id}`, patientName: `P${id}`, status, treatmentType, createdAt: '2026-11-01T00:00:00Z', statusUpdatedAt: `2026-11-0${id}T00:00:00Z`, submittedBy }
}

test('lab extras list re-dos, shipments and product mix', () => {
  const extras = buildLabExtras([labOrder(1, 'redo', 'Crown'), labOrder(2, 'shipped', 'Crown'), labOrder(3, 'shipped', 'Veneer'), labOrder(4, 'completed', null)])
  assert.deepEqual(extras.redo.map((item) => item.id), [1])
  assert.deepEqual(extras.inTransit.map((item) => item.id), [3, 2])
  assert.deepEqual(extras.productMix, [{ label: 'Crown', count: 2 }, { label: 'Veneer', count: 1 }, { label: 'Other', count: 1 }])
})

test('doctor summaries rank doctors with approvals waiting first', () => {
  const summaries = buildDoctorSummaries(
    [{ id: 1, name: 'Dr A' }, { id: 2, name: 'Dr B' }],
    [alignerCase(1, 'Lab Designing'), alignerCase(2, 'Awaiting Approval', { doctorAccountId: 2 })],
    [labOrder(1, 'pending', 'Crown', 1), labOrder(2, 'completed', 'Crown', 2)],
  )
  assert.deepEqual(summaries.map((row) => [row.name, row.activeAligners, row.awaitingApproval, row.activeLabOrders]), [['Dr B', 1, 1, 0], ['Dr A', 1, 0, 1]])
})
