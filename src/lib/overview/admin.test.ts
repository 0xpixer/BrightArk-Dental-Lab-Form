import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAdminAlignerOverview, buildAdminFinance, buildAdminLabOverview, parseSalesTargets, type AdminCaseInput, type AdminLabOrderInput } from './admin'

const now = new Date('2026-11-14T08:00:00Z')
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString()

function adminCase(id: number, latestProgress: string, ageDays: number, extra: Partial<AdminCaseInput> = {}): AdminCaseInput {
  return { id, orderNo: `IDA-${id}`, patientName: `P${id}`, latestProgress, createdOn: '2026-11-03', updatedAt: daysAgo(ageDays), doctorAccountId: 10, doctorName: 'Dr A', salesAccountId: 20, salesName: 'Sales A', category: 'iAlign', ...extra }
}

test('sales targets parse defensively', () => {
  assert.deepEqual(parseSalesTargets('{"20": 10, "21": "5", "x": 3, "22": -1}'), { 20: 10, 21: 5 })
  assert.deepEqual(parseSalesTargets('not json'), {})
  assert.deepEqual(parseSalesTargets(null), {})
})

test('aligner queues use the agreed thresholds', () => {
  const overview = buildAdminAlignerOverview([
    adminCase(1, 'Lab Designing', 4),
    adminCase(2, 'Lab Designing', 1),
    adminCase(3, 'Awaiting Approval', 6),
    adminCase(4, 'Awaiting Approval', 2),
    adminCase(5, 'Approved', 0),
    adminCase(6, 'In Production', 1, { salesAccountId: null }),
    adminCase(7, 'Completed', 40, { doctorAccountId: null }),
    adminCase(8, 'Entering Info', 9),
  ], [], {}, now)
  const queues = Object.fromEntries(overview.queues.map((item) => [item.key, item.items.map((row) => row.id)]))
  assert.deepEqual(queues, { design: [1], approval: [3], production: [5], unassigned: [6], entering: [8] })
  assert.equal(overview.totals.active, 7)
})

test('targets compare new cases this month per sales account', () => {
  const overview = buildAdminAlignerOverview([
    adminCase(1, 'Lab Designing', 1),
    adminCase(2, 'Lab Designing', 1),
    adminCase(3, 'Completed', 1, { createdOn: '2026-10-02' }),
    adminCase(4, 'Lab Designing', 1, { salesAccountId: 21, category: 'iScan' }),
  ], [{ id: 20, name: 'Sales A' }, { id: 21, name: 'Sales B' }], { 20: 4 }, now)
  assert.deepEqual(overview.salesLeaderboard.map((row) => [row.name, row.newThisMonth, row.target, row.percent]), [['Sales A', 2, 4, 50], ['Sales B', 1, 0, null]])
  assert.deepEqual(overview.targets, { totalTarget: 4, actual: 3, percent: 75 })
  assert.equal(overview.totals.newLastMonth, 1)
  assert.equal(overview.trend.at(-1)?.byCategory.iScan, 1)
})

test('finance totals invoiced, paid, unpaid and overdue by currency', () => {
  const finance = buildAdminFinance([
    { paymentStatus: 'Paid', dueDate: null, invoiceDate: '2026-09-01', originalPrice: '100', discount: null, totalAmount: null, currency: 'SGD' },
    { paymentStatus: 'Unpaid', dueDate: null, invoiceDate: '2026-09-01', originalPrice: '200', discount: '50', totalAmount: null, currency: 'SGD' },
    { paymentStatus: 'Invoice not issue', dueDate: null, invoiceDate: null, originalPrice: '999', discount: null, totalAmount: null, currency: 'SGD' },
  ], 30, '2026-11-14')
  assert.deepEqual(finance.invoiced, [{ currency: 'SGD', amount: 200 }])
  assert.deepEqual(finance.overdue, [{ currency: 'SGD', amount: 100 }])
  assert.equal(finance.counts.notInvoiced, 1)
})

test('lab queues separate stale pending, overdue and re-do orders', () => {
  const order = (id: number, status: string, ageDays: number, salesIds = [20]): AdminLabOrderInput => ({ id, orderNo: `L${id}`, patientName: `P${id}`, status, treatmentType: 'Crown', createdAt: daysAgo(ageDays), statusUpdatedAt: daysAgo(ageDays), doctorId: 10, doctorName: 'Dr A', salesIds })
  const overview = buildAdminLabOverview([order(1, 'pending', 3), order(2, 'pending', 1), order(3, 'in_production', 5), order(4, 'redo', 1), order(5, 'completed', 10)], [{ id: 20, name: 'Sales A' }], now)
  assert.deepEqual(Object.fromEntries(overview.queues.map((item) => [item.key, item.items.map((row) => row.id)])), { pending: [1], overdue: [3], redo: [4] })
  assert.equal(overview.salesLeaderboard[0].active, 4)
})
