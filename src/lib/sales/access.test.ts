import assert from 'node:assert/strict'
import test from 'node:test'
import { isDashboardRole, isSalesRole } from '@/lib/admin/roles'

test('recognizes sales as a scoped dashboard role without granting lab admin rights', () => {
  assert.equal(isSalesRole('sales'), true)
  assert.equal(isDashboardRole('sales'), true)
  assert.equal(isDashboardRole('doctor'), false)
})
