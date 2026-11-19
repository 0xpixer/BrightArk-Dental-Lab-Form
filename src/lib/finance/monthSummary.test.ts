import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFinanceMonthSummary } from './calc'

test('month summary: invoiced this month, paid + unpaid = total, per currency', () => {
  const row = (paymentStatus: string, invoiceDate: string | null, originalPrice: string, currency = 'IDR', discount: string | null = null) =>
    ({ paymentStatus, invoiceDate, originalPrice, discount, totalAmount: null, currency })
  const summary = buildFinanceMonthSummary([
    row('Paid', '2026-11-03', '1000'),
    row('Unpaid', '2026-11-20', '2000', 'IDR', '50'),
    row('Unpaid', '2026-11-21', '300', 'SGD'),
    row('Paid', '2026-10-30', '9999'),
    row('Free', '2026-11-05', '500'),
    row('Invoice not issue', null, '700'),
  ], '2026-11')
  assert.deepEqual(summary.total, [{ currency: 'IDR', amount: 2000 }, { currency: 'SGD', amount: 300 }])
  assert.deepEqual(summary.paid, [{ currency: 'IDR', amount: 1000 }])
  assert.deepEqual(summary.unpaid, [{ currency: 'IDR', amount: 1000 }, { currency: 'SGD', amount: 300 }])
  assert.deepEqual(summary.counts, { total: 3, paid: 1, unpaid: 2 })
})
