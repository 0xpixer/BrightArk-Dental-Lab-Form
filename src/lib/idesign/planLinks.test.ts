import assert from 'node:assert/strict'
import test from 'node:test'
import { getIDesignPlanHref, getIDesignPlanViewerHref, getSafeIDesignPlanReturnTo } from './planLinks'

test('builds the authenticated URL for the current editable treatment plan', () => {
  assert.equal(getIDesignPlanHref(42), '/api/idesign/cases/42/open')
})

test('builds an in-portal treatment plan viewer URL', () => {
  assert.equal(
    getIDesignPlanViewerHref(42, '/portal/idesign/orders', '/portal/idesign/orders?search=Lee&page=2'),
    '/portal/idesign/orders/42/plan?returnTo=%2Fportal%2Fidesign%2Forders%3Fsearch%3DLee%26page%3D2',
  )
})

test('allows only the matching iDesign list as a viewer return destination', () => {
  assert.equal(getSafeIDesignPlanReturnTo('/portal/idesign/orders?search=Lee&page=2', '/portal/idesign/orders'), '/portal/idesign/orders?search=Lee&page=2')
  assert.equal(getSafeIDesignPlanReturnTo('/admin/accounts', '/portal/idesign/orders'), '/portal/idesign/orders')
  assert.equal(getSafeIDesignPlanReturnTo('https://example.com', '/portal/idesign/orders'), '/portal/idesign/orders')
})
