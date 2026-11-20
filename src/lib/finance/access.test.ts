import test from 'node:test'
import assert from 'node:assert/strict'
import { financeSettingsSchema, maskEmail, resolveFinanceGate, signUnlockToken, verifyUnlockToken, FINANCE_UNLOCK_TTL_MS } from './access'

const row = (overrides: Partial<{ passwordHash: string | null; passwordVersion: number; staffVisible: boolean; setupAt: Date | null }> = {}) => ({
  passwordHash: null, passwordVersion: 0, staffVisible: false, setupAt: new Date(), ...overrides,
})

test('a doctor with no settings row must go through setup', () => {
  assert.deepEqual(resolveFinanceGate('doctor', null, null), { hidden: false, needsSetup: true, hasPassword: false, staffVisible: false })
  assert.equal(resolveFinanceGate('doctor', row({ passwordHash: 'x' }), null).hasPassword, true)
})

test('clinic staff are hidden until their doctor shares Finance', () => {
  assert.equal(resolveFinanceGate('clinic_staff', null, null).hidden, true)
  assert.equal(resolveFinanceGate('clinic_staff', row({ passwordHash: 'x' }), row({ staffVisible: false })).hidden, true)
  assert.equal(resolveFinanceGate('clinic_staff', row({ passwordHash: 'x' }), row({ staffVisible: false })).hasPassword, false)
  const shared = resolveFinanceGate('clinic_staff', null, row({ staffVisible: true }))
  assert.deepEqual(shared, { hidden: false, needsSetup: true, hasPassword: false, staffVisible: null })
})

test('lab roles are never gated', () => {
  assert.deepEqual(resolveFinanceGate('admin', null, null), { hidden: false, needsSetup: false, hasPassword: false, staffVisible: null })
})

test('unlock tokens are bound to the user, the password version and an expiry', () => {
  const now = 1_000_000
  const token = signUnlockToken('secret', 7, 2, now)
  assert.equal(verifyUnlockToken('secret', token, 7, 2, now + 1000), true)
  assert.equal(verifyUnlockToken('secret', token, 8, 2, now), false)
  assert.equal(verifyUnlockToken('secret', token, 7, 3, now), false)
  assert.equal(verifyUnlockToken('other', token, 7, 2, now), false)
  assert.equal(verifyUnlockToken('secret', token, 7, 2, now + FINANCE_UNLOCK_TTL_MS + 1), false)
  assert.equal(verifyUnlockToken('secret', token.replace(/.$/, (c) => c === 'a' ? 'b' : 'a'), 7, 2, now), false)
  assert.equal(verifyUnlockToken('secret', null, 7, 2, now), false)
})

test('settings need a password only when setting one', () => {
  assert.equal(financeSettingsSchema.safeParse({ passwordMode: 'set' }).success, false)
  assert.equal(financeSettingsSchema.safeParse({ passwordMode: 'set', password: '123' }).success, false)
  assert.equal(financeSettingsSchema.safeParse({ passwordMode: 'set', password: '123456' }).success, true)
  assert.equal(financeSettingsSchema.safeParse({ passwordMode: 'none', staffVisible: true }).success, true)
})

test('masks the reset email address', () => {
  assert.equal(maskEmail('jessie@example.com'), 'j*****@example.com')
  assert.equal(maskEmail('a@b.co'), 'a**@b.co')
})
