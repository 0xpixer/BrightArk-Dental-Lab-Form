import assert from 'node:assert/strict'
import test from 'node:test'
import { buildOverviewMetrics } from './overviewMetrics'

const now = new Date('2026-08-24T12:00:00.000Z')
const orders = [
  { status: 'pending', createdAt: '2026-08-24T02:00:00.000Z', statusUpdatedAt: '2026-08-20T00:00:00.000Z' },
  { status: 'completed', createdAt: '2026-08-10T02:00:00.000Z', statusUpdatedAt: '2026-08-12T00:00:00.000Z' },
  { status: 'redo', createdAt: '2026-07-15T02:00:00.000Z', statusUpdatedAt: '2026-08-23T00:00:00.000Z' },
  { status: 'in_production', createdAt: '2026-01-10T02:00:00.000Z', statusUpdatedAt: '2026-08-22T00:00:00.000Z' },
  { status: 'canceled', createdAt: '2026-01-11T02:00:00.000Z', statusUpdatedAt: '2026-01-11T00:00:00.000Z' },
]

test('builds all-time status totals and overdue counts', () => {
  const metrics = buildOverviewMetrics(orders, 'month', now)

  assert.deepEqual(metrics.totals, { all: 5, active: 3, completed: 1, overdue: 1 })
  assert.equal(metrics.statusCounts.pending, 1)
  assert.equal(metrics.statusCounts.completed, 1)
  assert.equal(metrics.statusCounts.redo, 1)
  assert.equal(metrics.statusCounts.canceled, 1)
})

test('groups recent order volume into weekly and monthly buckets', () => {
  const weekly = buildOverviewMetrics(orders, 'week', now)
  const monthly = buildOverviewMetrics(orders, 'month', now)

  assert.equal(weekly.trend.length, 8)
  assert.equal(weekly.trend.reduce((sum, point) => sum + point.count, 0), 3)
  assert.equal(monthly.trend.length, 6)
  assert.equal(monthly.trend.reduce((sum, point) => sum + point.count, 0), 3)
  assert.equal(weekly.periodLabel, 'Last 8 weeks')
  assert.equal(monthly.periodLabel, 'Last 6 months')
})
