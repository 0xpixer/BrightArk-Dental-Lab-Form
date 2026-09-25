import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import {
  completePasswordResetQuery,
  passwordResetAttemptQuery,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  savePasswordResetQuery,
  sendPasswordResetEmail,
} from './passwordReset'

test('password reset input accepts only bounded email, code, and password values', () => {
  assert.equal(passwordResetRequestSchema.safeParse({ email: ' Admin@Example.test ', turnstileToken: 'token' }).success, true)
  assert.equal(passwordResetRequestSchema.safeParse({ email: 'invalid', turnstileToken: 'token' }).success, false)
  assert.equal(passwordResetConfirmSchema.safeParse({ resetId: 'a'.repeat(64), code: '012345', password: 'new-password' }).success, true)
  for (const value of [
    { resetId: 'short', code: '012345', password: 'new-password' },
    { resetId: 'a'.repeat(64), code: '12345', password: 'new-password' },
    { resetId: 'a'.repeat(64), code: '012345', password: 'short' },
  ]) assert.equal(passwordResetConfirmSchema.safeParse(value).success, false)
})

test('password reset email contains only the short-lived code', async () => {
  await sendPasswordResetEmail('admin@example.test', '012345', 'reset-id', {
    apiKey: 'test-key',
    from: 'BrightArk <verify@example.test>',
  }, async (_url, init) => {
    const payload = JSON.parse(String(init?.body))
    assert.deepEqual(payload.to, ['admin@example.test'])
    assert.match(payload.text, /012345/)
    assert.match(payload.text, /15 minutes/)
    assert.equal(new Headers(init?.headers).get('Idempotency-Key'), 'password-reset/reset-id')
    return Response.json({ id: 'sent' })
  })
})

test('password reset challenges are one-time, bounded, and replace earlier codes', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  const migrations = new URL('../../drizzle/', import.meta.url)
  for (const file of (await readdir(migrations)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(file, migrations), 'utf8'))
  }
  const dialect = new PgDialect()
  const run = async (query: SQL) => {
    const { sql, params } = dialect.sqlToQuery(query)
    return db.query(sql, params)
  }
  const user = (await db.query<{ id: number }>(`INSERT INTO admin_users (username, email, password_hash, role, is_active)
    VALUES ('admin@example.test', 'admin@example.test', 'old-hash', 'superadmin', true) RETURNING id`)).rows[0]

  await run(savePasswordResetQuery('a'.repeat(64), user.id, 'first-hash'))
  await run(savePasswordResetQuery('b'.repeat(64), user.id, 'correct-hash'))
  assert.equal((await db.query('SELECT * FROM pending_password_resets')).rows.length, 1)
  assert.equal((await run(passwordResetAttemptQuery('a'.repeat(64)))).rows.length, 0)

  assert.equal((await run(passwordResetAttemptQuery('b'.repeat(64)))).rows.length, 1)
  assert.equal((await run(completePasswordResetQuery('b'.repeat(64), 'wrong-hash', 'unused-hash'))).rows.length, 0)
  assert.equal((await run(passwordResetAttemptQuery('b'.repeat(64)))).rows.length, 1)
  assert.equal((await run(completePasswordResetQuery('b'.repeat(64), 'correct-hash', 'new-hash'))).rows.length, 1)
  assert.equal((await run(completePasswordResetQuery('b'.repeat(64), 'correct-hash', 'replayed-hash'))).rows.length, 0)

  const updated = (await db.query<{ password_hash: string; password_changed_at: Date }>(
    'SELECT password_hash, password_changed_at FROM admin_users WHERE id = $1', [user.id],
  )).rows[0]
  assert.equal(updated.password_hash, 'new-hash')
  assert.ok(updated.password_changed_at)
})
