import assert from 'node:assert/strict'
import test from 'node:test'
import { getIDesignPlanApprovalState } from './approval'

test('allows approval only while a treatment plan awaits clinical review', () => {
  assert.deepEqual(getIDesignPlanApprovalState('Awaiting Clin. Review', 'published'), {
    approved: false,
    readyForApproval: true,
  })
  assert.equal(getIDesignPlanApprovalState('Lab Designing', 'published').readyForApproval, false)
})

test('treats later workflow statuses as approved without requiring a data update', () => {
  for (const status of ['Clin. Review Approved', 'In Production', 'Produced', 'Shipped', 'Delivered', 'Completed']) {
    assert.deepEqual(getIDesignPlanApprovalState(status, 'published'), {
      approved: true,
      readyForApproval: false,
    })
  }
})
