import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFinanceMonthSummary } from './calc'

const row = (paymentStatus: string, invoiceDate: string | null, originalPrice: string, currency = 'IDR', discount: string | null = null, paymentDate: string | null = null) =>
  ({ paymentStatus, invoiceDate, paymentDate, originalPrice, discount, totalAmount: null, currency })

test('month summary: due and unpaid by invoice date, paid by payment date, per currency', () => {
  const summary = buildFinanceMonthSummary([
    row('Paid', '2026-11-03', '1000', 'IDR', null, '2026-11-05'),
    row('Unpaid', '2026-11-20', '2000', 'IDR', '50'),
    row('Unpaid', '2026-11-21', '300', 'SGD'),
    row('Paid', '2026-10-30', '9999', 'IDR', null, '2026-11-02'),
    row('Paid', '2026-11-01', '400', 'IDR', null, '2026-12-01'),
    row('Free', '2026-11-05', '500'),
    row('Invoice not issue', null, '700'),
  ], '2026-11')
  assert.deepEqual(summary.total, [{ currency: 'IDR', amount: 2400 }, { currency: 'SGD', amount: 300 }])
  assert.deepEqual(summary.paid, [{ currency: 'IDR', amount: 10999 }], 'an October invoice paid in November counts as paid this month')
  assert.deepEqual(summary.unpaid, [{ currency: 'IDR', amount: 1000 }, { currency: 'SGD', amount: 300 }])
  assert.deepEqual(summary.counts, { total: 4, paid: 2, unpaid: 2 })
})

test('a Paid row without a payment date is not counted as paid this month', () => {
  const summary = buildFinanceMonthSummary([row('Paid', '2026-11-03', '1000')], '2026-11')
  assert.deepEqual(summary.paid, [])
  assert.equal(summary.counts.total, 1)
})
