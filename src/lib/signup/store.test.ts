import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { completeRegistrationQuery, rateLimitQuery, verificationAttemptQuery } from './store'

test('signup migrations and security queries on isolated in-memory Postgres', async (t) => {
  // This database never opens a network connection or reads DATABASE_URL.
  const db = new PGlite()
  t.after(() => db.close())
  const migrations = new URL('../../../drizzle/', import.meta.url)
  for (const file of (await readdir(migrations)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(file, migrations), 'utf8'))
  }
  const dialect = new PgDialect()
  const run = async (query: SQL) => {
    const { sql, params } = dialect.sqlToQuery(query)
    return db.query(sql, params)
  }
  const addPending = async (id: string, email = `${id}@example.test`, expires = "now() + interval '15 minutes'") => {
    await db.query(`INSERT INTO pending_registrations (id, email, password_hash, full_name, clinic_name, address, code_hash, expires_at)
      VALUES ($1, $2, 'hashed-password', 'Test Doctor', 'Test Clinic', 'Test address', 'correct-hash', ${expires})`, [id, email])
  }

  await t.test('rate limits are atomic across callers, stop at the limit, and reset after expiry', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => run(rateLimitQuery('ip-test', 10, 3600))))
    assert.equal(results.filter((result) => result.rows.length === 1).length, 10)
    await db.exec("UPDATE signup_rate_limits SET expires_at = now() - interval '1 second'")
    assert.equal((await run(rateLimitQuery('ip-test', 10, 3600))).rows.length, 1)
  })
  await t.test('unverified signup cannot create a usable account', async () => {
    await addPending('pending')
    assert.equal((await db.query('SELECT * FROM admin_users')).rows.length, 0)
    assert.equal((await run(verificationAttemptQuery('pending'))).rows.length, 1)
    assert.equal((await run(completeRegistrationQuery('pending', 'wrong-hash'))).rows.length, 0)
    assert.equal((await db.query('SELECT * FROM admin_users')).rows.length, 0)
  })
  await t.test('correct code creates only a Doctor and its clinic, then cannot be replayed', async () => {
    assert.equal((await run(verificationAttemptQuery('pending'))).rows.length, 1)
    assert.equal((await run(completeRegistrationQuery('pending', 'correct-hash'))).rows.length, 1)
    const user = (await db.query<{ role: string; email_verified_at: Date }>('SELECT * FROM admin_users')).rows[0]
    assert.equal(user.role, 'doctor')
    assert.ok(user.email_verified_at)
    assert.equal((await db.query('SELECT * FROM doctor_clinics')).rows.length, 1)
    assert.equal((await run(completeRegistrationQuery('pending', 'correct-hash'))).rows.length, 0)
  })
  await t.test('expired challenges cannot verify', async () => {
    await addPending('expired', 'expired@example.test', "now() - interval '1 second'")
    assert.equal((await run(verificationAttemptQuery('expired'))).rows.length, 0)
    assert.equal((await run(completeRegistrationQuery('expired', 'correct-hash'))).rows.length, 0)
  })
  await t.test('five guesses exhaust the challenge, regardless of IP changes', async () => {
    await addPending('guesses')
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await run(verificationAttemptQuery('guesses'))).rows.length, 1)
      assert.equal((await run(completeRegistrationQuery('guesses', 'wrong-hash'))).rows.length, 0)
    }
    assert.equal((await run(verificationAttemptQuery('guesses'))).rows.length, 0)
  })
  await t.test('concurrent valid codes create only one account and never overwrite an existing password', async () => {
    await addPending('duplicate-a', 'duplicate@example.test')
    await addPending('duplicate-b', 'duplicate@example.test')
    const results = await Promise.all(['duplicate-a', 'duplicate-b'].map((id) => run(completeRegistrationQuery(id, 'correct-hash'))))
    assert.equal(results.filter((result) => result.rows.length === 1).length, 1)
    await addPending('takeover', 'duplicate@example.test')
    await db.exec("UPDATE pending_registrations SET password_hash = 'attacker-hash' WHERE id = 'takeover'")
    assert.equal((await run(completeRegistrationQuery('takeover', 'correct-hash'))).rows.length, 0)
    const user = (await db.query<{ password_hash: string }>("SELECT password_hash FROM admin_users WHERE email = 'duplicate@example.test'")).rows[0]
    assert.equal(user.password_hash, 'hashed-password')
  })
  await t.test('clinic failure rolls back account creation and challenge consumption', async () => {
    await addPending('rollback')
    await db.exec("ALTER TABLE doctor_clinics ADD CONSTRAINT test_failure CHECK (name <> 'Test Clinic') NOT VALID")
    await assert.rejects(run(completeRegistrationQuery('rollback', 'correct-hash')))
    assert.equal((await db.query("SELECT * FROM pending_registrations WHERE id = 'rollback'")).rows.length, 1)
    assert.equal((await db.query("SELECT * FROM admin_users WHERE email = 'rollback@example.test'")).rows.length, 0)
  })
})
