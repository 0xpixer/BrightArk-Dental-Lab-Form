import assert from 'node:assert/strict'
import test from 'node:test'
import { getIDesignPlanApprovalState } from './approval'

test('allows approval only while a treatment plan awaits approval', () => {
  assert.deepEqual(getIDesignPlanApprovalState('Awaiting Approval', 'published'), {
    approved: false,
    readyForApproval: true,
  })
  assert.equal(getIDesignPlanApprovalState('Lab Designing', 'published').readyForApproval, false)
})

test('treats later workflow statuses as approved without requiring a data update', () => {
  for (const status of ['Approved', 'In Production', 'Produced', 'Shipped', 'Delivered', 'Completed']) {
    assert.deepEqual(getIDesignPlanApprovalState(status, 'published'), {
      approved: true,
      readyForApproval: false,
    })
  }
})

test('a canceled case is not treated as approved or approvable', () => {
  assert.deepEqual(getIDesignPlanApprovalState('Canceled', 'published'), { approved: false, readyForApproval: false })
  assert.deepEqual(getIDesignPlanApprovalState('Canceled', 'approved'), { approved: true, readyForApproval: false })
})
