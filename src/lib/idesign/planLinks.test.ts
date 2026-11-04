import assert from 'node:assert/strict'
import test from 'node:test'
import { getIDesignPlanHref } from './planLinks'

test('builds the authenticated URL for the current editable treatment plan', () => {
  assert.equal(getIDesignPlanHref(42), '/api/idesign/cases/42/open')
})
