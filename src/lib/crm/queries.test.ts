import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { PgDialect } from 'drizzle-orm/pg-core'
import { sql, type SQL } from 'drizzle-orm'
import { completeRegistrationQuery } from '../signup/store'
import { buildCrmAccess } from './crm'
import { crmScopeSql, insertAssignedCrmQuery, linkCrmByEmailQuery } from './queries'
import { onDoctorRegistered, onSalesAssignmentsChanged, syncCrm } from './hooks'

interface CrmDbRow {
  id: number
  doctor_account_id: number | null
  source: string
  status: string
  email: string | null
  notes: string | null
  full_name: string
  phone: string | null
}

test('CRM linking, merging and scope on isolated in-memory Postgres', async (t) => {
  // Never touches DATABASE_URL: every migration runs against an in-memory database.
  const db = new PGlite()
  t.after(() => db.close())
  const migrations = new URL('../../../drizzle/', import.meta.url)
  for (const file of (await readdir(migrations)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(file, migrations), 'utf8'))
  }
  const dialect = new PgDialect()
  const run = async <T = Record<string, unknown>>(query: SQL) => {
    const { sql: text, params } = dialect.sqlToQuery(query)
    return (await db.query<T>(text, params)).rows
  }
  const user = async (username: string, role: string, extra: Record<string, string | null> = {}) => {
    const fields: Record<string, string | null> = { username, role, password_hash: 'x', ...extra }
    const keys = Object.keys(fields)
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ')
    const result = await db.query<{ id: number }>(`INSERT INTO admin_users (${keys.join(', ')}) VALUES (${placeholders}) RETURNING id`, Object.values(fields))
    return result.rows[0].id
  }
  const addCrm = async (salesId: number, fullName: string, email: string | null, status = 'lead') => {
    const result = await db.query<{ id: number }>(
      "INSERT INTO crm_doctors (sales_id, full_name, email, status, source) VALUES ($1, $2, $3, $4, 'sales') RETURNING id",
      [salesId, fullName, email, status],
    )
    return result.rows[0].id
  }
  const crmRows = async (salesId: number) => (await db.query<CrmDbRow>('SELECT * FROM crm_doctors WHERE sales_id = $1 ORDER BY id', [salesId])).rows
  const assign = (salesId: number, doctorId: number) => db.query('INSERT INTO sales_doctor_assignments (sales_id, doctor_id) VALUES ($1, $2)', [salesId, doctorId])
  const execute = (query: SQL) => run(query)
  const sync = (salesIds?: number[]) => syncCrm(salesIds, execute)

  const director = await user('director', 'sales_director')
  const repA = await user('rep-a', 'sales')
  const repB = await user('rep-b', 'sales')
  const outsider = await user('rep-c', 'sales')
  await db.query('INSERT INTO sales_director_assignments (director_id, sales_id) VALUES ($1, $2), ($1, $3)', [director, repA, repB])

  await t.test('existing assigned doctors are back-filled with their registration data, idempotently', async () => {
    const doctor = await user('existing@example.test', 'doctor', {
      email: 'existing@example.test', full_name: 'Dr Existing', phone: '+62 811', clinic_name: 'Smile Clinic',
      country: 'Indonesia', city: 'Jakarta', address: 'Jl. Sudirman 1',
    })
    await assign(repA, doctor)
    assert.equal((await run(insertAssignedCrmQuery({ salesIds: [repA] }))).length, 1)
    assert.equal((await run(insertAssignedCrmQuery({ salesIds: [repA] }))).length, 0, 'second run adds nothing')
    assert.equal((await run(insertAssignedCrmQuery())).length, 0)
    const [row] = await crmRows(repA)
    assert.equal(row.doctor_account_id, doctor)
    assert.equal(row.source, 'registered')
    assert.equal(row.full_name, 'Dr Existing')
    assert.equal(row.phone, '+62 811')
    assert.equal(row.status, 'lead', 'no orders yet')
  })

  await t.test('a sales-added record is linked on registration by email, case-insensitively, keeping its CRM data', async () => {
    const crmId = await addCrm(repB, 'Dr Lead', 'New.Doctor@Example.test', 'trial')
    await db.query("UPDATE crm_doctors SET notes = 'met at expo' WHERE id = $1", [crmId])
    await db.query(`INSERT INTO pending_registrations (id, email, password_hash, full_name, clinic_name, address, country, city, code_hash, expires_at)
      VALUES ('reg', 'new.doctor@example.test', 'h', 'Dr New', 'New Clinic', 'Addr', 'Singapore', 'Singapore', 'ok', now() + interval '1 hour')`)
    const [created] = await run<{ id: number }>(completeRegistrationQuery('reg', 'ok'))
    await onDoctorRegistered(created.id, execute)
    let rows = await crmRows(repB)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, crmId)
    assert.equal(rows[0].doctor_account_id, created.id)
    assert.equal(rows[0].status, 'trial')
    assert.equal(rows[0].notes, 'met at expo')
    assert.equal(rows[0].source, 'sales')

    // Assigning the doctor to the rep later reuses the same row instead of adding a duplicate.
    await assign(repB, created.id)
    await onSalesAssignmentsChanged([repB], execute)
    rows = await crmRows(repB)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, crmId)
    assert.equal((await run(linkCrmByEmailQuery({ doctorAccountId: created.id }))).length, 0, 'linking is idempotent')
  })

  await t.test('assignment back-fill links a sales-added record when the doctor registered first', async () => {
    const doctor = await user('later@example.test', 'doctor', { email: 'later@example.test', full_name: 'Dr Later' })
    const crmId = await addCrm(repA, 'Dr Later (lead)', 'LATER@example.test')
    await assign(repA, doctor)
    await sync([repA])
    const rows = (await crmRows(repA)).filter((row) => row.email?.toLowerCase() === 'later@example.test')
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, crmId)
    assert.equal(rows[0].doctor_account_id, doctor)
  })

  await t.test('two reps can each track the same doctor; one rep cannot hold the same email twice', async () => {
    await addCrm(outsider, 'Dr Later elsewhere', 'later@example.test')
    await sync()
    const linked = await db.query('SELECT sales_id FROM crm_doctors WHERE lower(email) = $1 AND doctor_account_id IS NOT NULL', ['later@example.test'])
    assert.equal(linked.rows.length, 2)
    await assert.rejects(addCrm(repA, 'Duplicate', 'Later@Example.test'), /duplicate key/)
    assert.equal((await run(linkCrmByEmailQuery({ crmId: 999999 }))).length, 0)
  })

  await t.test('only doctor accounts are linked', async () => {
    await user('staff@example.test', 'clinic_staff', { email: 'staff@example.test' })
    await addCrm(repA, 'Not a doctor', 'staff@example.test')
    await sync()
    const [row] = (await crmRows(repA)).filter((candidate) => candidate.email === 'staff@example.test')
    assert.equal(row.doctor_account_id, null)
  })

  await t.test('scope SQL: superadmin all, director their reps, rep own, admin nothing', async () => {
    const visibleTo = async (userId: number, role: string, scope: number[]) => {
      const access = buildCrmAccess(userId, role, scope)
      if (!access) return null
      const rows = await run<{ sales_id: number }>(sql`SELECT DISTINCT c.sales_id FROM crm_doctors c WHERE ${crmScopeSql(access)} ORDER BY c.sales_id`)
      return rows.map((row) => row.sales_id)
    }
    assert.deepEqual(await visibleTo(1, 'superadmin', []), [repA, repB, outsider])
    assert.deepEqual(await visibleTo(director, 'sales_director', [director, repA, repB]), [repA, repB])
    assert.deepEqual(await visibleTo(repA, 'sales', [repA]), [repA])
    assert.deepEqual(await visibleTo(repB, 'sales', [repB, repA]), [repB], 'a rep never inherits other reps')
    assert.equal(await visibleTo(1, 'admin', []), null)
  })

  await t.test('hooks never throw, so registration and assignment saves cannot fail because of the CRM', async () => {
    const failing = async () => { throw new Error('database down') }
    const original = console.error
    console.error = () => undefined
    try {
      await assert.doesNotReject(onDoctorRegistered(1, failing))
      await assert.doesNotReject(onSalesAssignmentsChanged([1], failing))
    } finally {
      console.error = original
    }
  })

  await t.test('doctors with orders start as Active', async () => {
    const doctor = await user('busy@example.test', 'doctor', { email: 'busy@example.test', full_name: 'Dr Busy' })
    await db.query(`INSERT INTO idesign_orders (salesperson_name, country, patient_name, doctor_name, doctor_account_id, latest_progress, category, payment_status)
      VALUES ('x', 'ID', 'P', 'Dr Busy', $1, 'In Production', 'Clear Aligner', 'Unpaid')`, [doctor])
    await assign(outsider, doctor)
    await run(insertAssignedCrmQuery({ doctorIds: [doctor] }))
    const [row] = (await crmRows(outsider)).filter((candidate) => candidate.doctor_account_id === doctor)
    assert.equal(row.status, 'active')
  })
})
