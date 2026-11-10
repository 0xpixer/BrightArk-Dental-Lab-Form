import assert from 'node:assert/strict'
import test from 'node:test'
import { formatAdminRole, isAccountRole, isAdminRole, isDashboardRole, isDesignerRole, isPortalRole, isSalesRole } from './roles'

test('Treatment Plan Designer is a dashboard account without other role privileges', () => {
  assert.equal(isAccountRole('treatment_designer'), true)
  assert.equal(isDashboardRole('treatment_designer'), true)
  assert.equal(isDesignerRole('treatment_designer'), true)
  assert.equal(isAdminRole('treatment_designer'), false)
  assert.equal(isSalesRole('treatment_designer'), false)
  assert.equal(isPortalRole('treatment_designer'), false)
  assert.equal(formatAdminRole('treatment_designer'), 'Treatment Plan Designer')
})

test('Sales Director inherits Sales permissions', () => {
  assert.equal(isSalesRole('sales_director'), true)
  assert.equal(isDashboardRole('sales_director'), true)
  assert.equal(isAccountRole('sales_director'), true)
  assert.equal(isAdminRole('sales_director'), false)
  assert.equal(formatAdminRole('sales_director'), 'Sales Director')
})
