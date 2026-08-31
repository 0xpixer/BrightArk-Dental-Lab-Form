import assert from 'node:assert/strict'
import test from 'node:test'
import { isDeliveredReadyForCompletion, isOrderStatusOverdue, normalizeOrderStatusFilter, normalizeOrderStatusFilters, ORDER_STATUS_OPTIONS } from './orderStatus'

test('keeps the requested status workflow order', () => {
  assert.deepEqual(ORDER_STATUS_OPTIONS.map((option) => option.label), [
    'Pending', 'Lab Designing', 'In Production', 'Shipped', 'Delivered', 'Re-Do', 'Completed', 'Canceled',
  ])
})

test('marks non-terminal statuses overdue at 72 hours', () => {
  const updatedAt = new Date('2026-08-01T00:00:00Z')
  assert.equal(isOrderStatusOverdue('in_production', updatedAt, new Date('2026-08-03T23:59:59Z')), false)
  assert.equal(isOrderStatusOverdue('in_production', updatedAt, new Date('2026-08-04T00:00:00Z')), true)
  assert.equal(isOrderStatusOverdue('completed', updatedAt, new Date('2026-08-10T00:00:00Z')), false)
  assert.equal(isOrderStatusOverdue('canceled', updatedAt, new Date('2026-08-10T00:00:00Z')), false)
})

test('normalizes status links and allows the derived overdue filter', () => {
  assert.equal(normalizeOrderStatusFilter('pending'), 'pending')
  assert.equal(normalizeOrderStatusFilter('overdue'), 'overdue')
  assert.equal(normalizeOrderStatusFilter(['shipped', 'pending']), 'shipped')
  assert.equal(normalizeOrderStatusFilter('unknown'), 'all')
})

test('normalizes multiple unique status filters', () => {
  assert.deepEqual(normalizeOrderStatusFilters(['pending', 'shipped', 'pending']), ['pending', 'shipped'])
  assert.deepEqual(normalizeOrderStatusFilters('delivered,overdue,unknown'), ['delivered', 'overdue'])
  assert.deepEqual(normalizeOrderStatusFilters('all'), [])
})

test('completes delivered orders once their status is 14 days old', () => {
  const deliveredAt = new Date('2026-08-01T00:00:00Z')
  assert.equal(isDeliveredReadyForCompletion('delivered', deliveredAt, new Date('2026-08-14T23:59:59Z')), false)
  assert.equal(isDeliveredReadyForCompletion('delivered', deliveredAt, new Date('2026-08-15T00:00:00Z')), true)
  assert.equal(isDeliveredReadyForCompletion('completed', deliveredAt, new Date('2026-08-20T00:00:00Z')), false)
})
