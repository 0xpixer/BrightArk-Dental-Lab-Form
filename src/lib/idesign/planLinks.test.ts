import assert from 'node:assert/strict'
import test from 'node:test'
import { getIDesignPlanReviewHref } from './planLinks'

test('builds the authenticated review URL for a published treatment plan version', () => {
  assert.equal(
    getIDesignPlanReviewHref(42, 3),
    '/api/idesign/cases/42/open?type=review&version=3',
  )
})
