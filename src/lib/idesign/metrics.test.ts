import assert from 'node:assert/strict'
import test from 'node:test'
import { buildIDesignMetrics } from './metrics'

test('summarizes iDesign progress, payments, categories, and recent volume', () => {
    const rows = [
      { sourceCreatedOn: '2026-08-26', latestProgress: 'Entering Info', paymentStatus: 'Free', category: 'iAlign' },
      { sourceCreatedOn: '2026-08-12', latestProgress: 'Produced', paymentStatus: 'Unpaid', category: 'iScan' },
      { sourceCreatedOn: '2026-07-31', latestProgress: 'Completed', paymentStatus: 'Paid', category: 'iAlign' },
    ]

    const metrics = buildIDesignMetrics(rows, new Date('2026-08-30T00:00:00Z'))

    assert.equal(metrics.total, 3)
    assert.equal(metrics.newCasesThisMonth, 2)
    assert.equal(metrics.casesLastMonth, 1)
    assert.equal(metrics.paid, 1)
    assert.equal(metrics.unpaid, 1)
    assert.equal(metrics.statusCounts.Produced, 1)
    assert.equal(metrics.categoryCounts.iAlign, 2)
    assert.deepEqual(metrics.trend.at(-1), { key: '2026-08', label: 'Aug', count: 2 })
})
