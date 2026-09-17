import assert from 'node:assert/strict'
import test from 'node:test'
import { Auth } from '@auth/core'
import { encode } from '@auth/core/jwt'
import { authConfig } from '@/auth.config'
import { createCurrentAccountJwtCallback } from './currentAccountSession'

const secret = 'local-session-regression-test-only-never-a-production-secret'
const cookieName = 'authjs.session-token'
const activeAccount = { id: 4, username: 'sales-test', fullName: 'Sales Test', role: 'sales', isActive: true }

async function readSession(
  cookie: string,
  loadAccount: Parameters<typeof createCurrentAccountJwtCallback>[0],
) {
  const response = await Auth(new Request('http://localhost/api/auth/session', {
    headers: { cookie: `${cookieName}=${cookie}` },
  }), {
    ...authConfig,
    secret,
    basePath: '/api/auth',
    session: { strategy: 'jwt' },
    callbacks: { ...authConfig.callbacks, jwt: createCurrentAccountJwtCallback(loadAccount) },
  })
  assert.equal(response.status, 200)
  return response.json()
}

test('an existing superadmin cookie immediately resolves the current Sales or Doctor role', async () => {
  const cookie = await encode({ secret, salt: cookieName, token: { id: '4', role: 'superadmin' } })
  for (const role of ['sales', 'doctor']) {
    const session = await readSession(cookie, async (id) => {
      assert.equal(id, 4)
      return { ...activeAccount, role }
    })
    assert.equal(session.user.role, role)
    assert.equal(session.user.username, activeAccount.username)
  }
})

test('deleted, deactivated, and unknown-role accounts cannot reuse a valid session cookie', async () => {
  const cookie = await encode({ secret, salt: cookieName, token: { id: '4', role: 'superadmin' } })
  for (const account of [null, { ...activeAccount, isActive: false }, { ...activeAccount, role: 'unknown' }]) {
    assert.equal(await readSession(cookie, async () => account), null)
  }
})

test('current account permissions are rechecked on every request with the same cookie', async () => {
  let account = { ...activeAccount, role: 'superadmin' }
  const cookie = await encode({ secret, salt: cookieName, token: { id: '4', role: 'superadmin' } })
  const loadAccount = async () => account
  assert.equal((await readSession(cookie, loadAccount)).user.role, 'superadmin')
  account = { ...account, role: 'sales' }
  assert.equal((await readSession(cookie, loadAccount)).user.role, 'sales')
  account = { ...account, isActive: false }
  assert.equal(await readSession(cookie, loadAccount), null)
})

test('invalid account IDs fail closed without a database lookup', async () => {
  for (const id of ['0', '-1', 'invalid']) {
    const cookie = await encode({ secret, salt: cookieName, token: { id, role: 'superadmin' } })
    assert.equal(await readSession(cookie, async () => { throw new Error('Unexpected account lookup') }), null)
  }
})
