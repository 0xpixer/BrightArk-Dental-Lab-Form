import assert from 'node:assert/strict'
import test from 'node:test'
import { isOrderStatusOverdue, normalizeOrderStatusFilter, ORDER_STATUS_OPTIONS } from './orderStatus'

test('keeps the requested status workflow order', () => {
  assert.deepEqual(ORDER_STATUS_OPTIONS.map((option) => option.label), [
    'Pending', 'Lab Designing', 'In Production', 'Shipped', 'Delivered', 'Re-Do', 'Completed',
  ])
})

test('marks non-completed statuses overdue at 72 hours', () => {
  const updatedAt = new Date('2026-08-01T00:00:00Z')
  assert.equal(isOrderStatusOverdue('in_production', updatedAt, new Date('2026-08-03T23:59:59Z')), false)
  assert.equal(isOrderStatusOverdue('in_production', updatedAt, new Date('2026-08-04T00:00:00Z')), true)
  assert.equal(isOrderStatusOverdue('completed', updatedAt, new Date('2026-08-10T00:00:00Z')), false)
})

test('normalizes status links and allows the derived overdue filter', () => {
  assert.equal(normalizeOrderStatusFilter('pending'), 'pending')
  assert.equal(normalizeOrderStatusFilter('overdue'), 'overdue')
  assert.equal(normalizeOrderStatusFilter(['shipped', 'pending']), 'shipped')
  assert.equal(normalizeOrderStatusFilter('unknown'), 'all')
})
