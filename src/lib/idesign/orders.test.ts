import assert from 'node:assert/strict'
import test from 'node:test'
import { applyIDesignOrderLogic, createIDesignOrderSchema } from './orders'

test('applies iDesign table formulas without replacing supplied historic values', () => {
  const parsed = createIDesignOrderSchema.parse({
    salespersonName: 'Germain Ho',
    country: 'Indonesia',
    patientName: 'Patient',
    doctorName: 'Doctor',
    latestProgress: 'Entering Info',
    category: 'iAlign',
    originalPrice: '299',
    discount: '30%',
    actualPayment: '$593.09',
    paymentStatus: 'Paid',
    paymentDate: '2026-08-10',
    salesCommissionRate: '5%',
  })

  const result = applyIDesignOrderLogic(parsed, '2026-09-01')

  assert.equal(result.country, 'Singapore')
  assert.equal(result.totalAmount, '209.3')
  assert.equal(result.attributedMonth, 'August')
  assert.equal(result.salesCommission, '29.65')
  assert.equal(result.sourceCreatedOn, '2026-09-01')
  assert.equal(result.sourceUpdatedOn, '2026-09-01')
})
