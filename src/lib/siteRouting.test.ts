import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getDefaultOverviewPath,
  getIDesignOverviewPath,
  getLoginPath,
  getSafeLoginCallback,
  isIDesignHostname,
} from './siteRouting'

test('recognizes the iDesign hostname with common proxy formatting', () => {
  assert.equal(isIDesignHostname('order.thebrightark.com'), true)
  assert.equal(isIDesignHostname('ORDER.THEBRIGHTARK.COM:443'), true)
  assert.equal(isIDesignHostname('idesign.thebrightark.com'), true)
  assert.equal(isIDesignHostname('IDESIGN.THEBRIGHTARK.COM:443'), true)
  assert.equal(isIDesignHostname('idesign.thebrightark.com, proxy.internal'), true)
  assert.equal(isIDesignHostname('bright-ark-dental-lab-form.vercel.app'), false)
  assert.equal(isIDesignHostname(null), false)
})

test('routes portal and dashboard roles to their own overview', () => {
  assert.equal(getIDesignOverviewPath('doctor'), '/portal/overview')
  assert.equal(getIDesignOverviewPath('clinic_staff'), '/portal/overview')
  assert.equal(getIDesignOverviewPath('sales'), '/admin/overview?view=aligners')
  assert.equal(getIDesignOverviewPath('superadmin'), '/admin/overview?view=aligners')
  assert.equal(getIDesignOverviewPath(undefined), '/admin/overview?view=aligners')
})

test('encodes the full overview callback in the login URL', () => {
  assert.equal(
    getLoginPath('/admin/overview?view=aligners'),
    '/admin/login?callbackUrl=%2Fadmin%2Foverview%3Fview%3Daligners',
  )
})

test('uses Overview as the default login destination', () => {
  assert.equal(getDefaultOverviewPath('order.thebrightark.com'), '/admin/overview?view=aligners')
  assert.equal(getDefaultOverviewPath('idesign.thebrightark.com'), '/admin/overview?view=aligners')
  assert.equal(getDefaultOverviewPath('bright-ark-dental-lab-form.vercel.app'), '/admin/overview')
})

test('only accepts same-site callback paths', () => {
  assert.equal(
    getSafeLoginCallback('/admin/overview?view=aligners', 'order.thebrightark.com'),
    '/admin/overview?view=aligners',
  )
  assert.equal(getSafeLoginCallback(null, 'order.thebrightark.com'), '/admin/overview?view=aligners')
  assert.equal(getSafeLoginCallback('https://attacker.test', 'order.thebrightark.com'), '/admin/overview?view=aligners')
  assert.equal(getSafeLoginCallback('//attacker.test', 'thebrightark.com'), '/admin/overview')
})
