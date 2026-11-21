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
import { setDoctorSales } from '../relationships/server'

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

  await t.test('another rep\'s lead for a doctor already assigned elsewhere folds into the assigned rep\'s record; one rep cannot hold the same email twice', async () => {
    const lead = await addCrm(outsider, 'Dr Later elsewhere', 'later@example.test')
    await db.query("UPDATE crm_doctors SET notes = 'met at expo too' WHERE id = $1", [lead])
    await sync()
    const linked = await db.query<{ sales_id: number; notes: string | null }>('SELECT sales_id, notes FROM crm_doctors WHERE lower(email) = $1 AND doctor_account_id IS NOT NULL', ['later@example.test'])
    assert.equal(linked.rows.length, 1, 'one doctor, one record')
    assert.equal(linked.rows[0].sales_id, repA, 'it sits with the doctor\'s assigned rep')
    assert.equal(linked.rows[0].notes, 'met at expo too', 'the lead\'s notes are kept')
    await addCrm(outsider, 'Unlinked lead', null)
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

test('migration 0039 back-fills the single Tag from old free-form tags', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  const migrations = new URL('../../../drizzle/', import.meta.url)
  const files = (await readdir(migrations)).filter((name) => name.endsWith('.sql')).sort()
  const cut = files.findIndex((name) => name.startsWith('0039_'))
  assert.ok(cut > 0, 'migration 0039 exists')
  for (const file of files.slice(0, cut)) await db.exec(await readFile(new URL(file, migrations), 'utf8'))
  const rep = (await db.query<{ id: number }>("INSERT INTO admin_users (username, role, password_hash) VALUES ('rep', 'sales', 'x') RETURNING id")).rows[0].id
  const cases: [string, string | null][] = [['["vip", "ka"]', 'KA'], ['["Non-KA"]', 'Non-KA'], ['["OEM"]', 'OEM'], ['["distributor", "x"]', 'Distributor'], ['["vip"]', null], ['[]', null]]
  for (const [index, [tags]] of cases.entries()) {
    await db.query('INSERT INTO crm_doctors (sales_id, full_name, tags) VALUES ($1, $2, $3::jsonb)', [rep, `Dr ${index}`, tags])
  }
  for (const file of files.slice(cut)) await db.exec(await readFile(new URL(file, migrations), 'utf8'))
  const rows = (await db.query<{ account_type: string | null }>('SELECT account_type FROM crm_doctors ORDER BY id')).rows
  assert.deepEqual(rows.map((row) => row.account_type), cases.map(([, expected]) => expected))
})

test('moving a doctor to another sales rep moves the CRM record instead of duplicating it', async (t) => {
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
  const user = async (username: string, role: string, email: string | null = null) =>
    (await db.query<{ id: number }>('INSERT INTO admin_users (username, role, password_hash, email, full_name) VALUES ($1, $2, $3, $4, $1) RETURNING id', [username, role, 'x', email])).rows[0].id
  const rowsFor = async (doctorId: number) => (await db.query<{ id: number; sales_id: number; status: string; notes: string | null; avatar_url: string | null; account_type: string | null; contract_url: string | null }>(
    'SELECT id, sales_id, status, notes, avatar_url, account_type, contract_url FROM crm_doctors WHERE doctor_account_id = $1 ORDER BY id', [doctorId])).rows
  const germain = await user('germain', 'sales')
  const lj = await user('lj', 'sales')
  const third = await user('third', 'sales')

  await t.test('Relationships / CRM reassignment keeps one record with its CRM data and history', async () => {
    const doctor = await user('dr-pua', 'doctor', 'drpua@oxleydental.sg')
    await setDoctorSales([doctor], germain, null, { moveOrders: true }, run)
    const [original] = await rowsFor(doctor)
    assert.equal(original.sales_id, germain)
    await db.query("UPDATE crm_doctors SET status = 'trial', notes = 'Met at IDS', avatar_url = 'https://x.public.blob.vercel-storage.com/crm-avatars/p.webp', account_type = 'KA', contract_url = 'https://x.public.blob.vercel-storage.com/crm-contracts/c.pdf' WHERE id = $1", [original.id])
    await db.query("INSERT INTO crm_activities (crm_doctor_id, kind, body) VALUES ($1, 'call', 'Intro call')", [original.id])

    await setDoctorSales([doctor], lj, null, { moveOrders: true }, run)
    const rows = await rowsFor(doctor)
    assert.equal(rows.length, 1, 'no duplicate')
    assert.equal(rows[0].id, original.id, 'same record, history kept')
    assert.equal(rows[0].sales_id, lj)
    assert.equal(rows[0].status, 'trial')
    assert.equal(rows[0].notes, 'Met at IDS')
    assert.equal(rows[0].account_type, 'KA')
    assert.ok(rows[0].avatar_url && rows[0].contract_url)
    assert.equal((await db.query('SELECT * FROM crm_activities WHERE crm_doctor_id = $1', [original.id])).rows.length, 1)
    await syncCrm(undefined, run)
    assert.equal((await rowsFor(doctor)).length, 1, 'stable on later syncs')
  })

  await t.test('existing duplicates are folded together: newest edit wins, notes combined, activities moved', async () => {
    const doctor = await user('dr-loke', 'doctor', 'loke@ledentistry.sg')
    await db.query('INSERT INTO sales_doctor_assignments (sales_id, doctor_id) VALUES ($1, $2)', [lj, doctor])
    // The state the bug left behind: Germain's old record plus LJ's auto-created one.
    const old = (await db.query<{ id: number }>("INSERT INTO crm_doctors (sales_id, doctor_account_id, full_name, status, notes, updated_at) VALUES ($1, $2, 'Dr Loke', 'active', 'Prefers WhatsApp', now() - interval '2 days') RETURNING id", [germain, doctor])).rows[0].id
    const dup = (await db.query<{ id: number }>("INSERT INTO crm_doctors (sales_id, doctor_account_id, full_name, status, source, notes, account_type, created_at, updated_at) VALUES ($1, $2, 'Dr Loke', 'contacted', 'registered', 'Asked for price list', 'OEM', now() - interval '1 day', now()) RETURNING id", [lj, doctor])).rows[0].id
    await db.query("INSERT INTO crm_activities (crm_doctor_id, kind, body) VALUES ($1, 'note', 'logged on the duplicate')", [dup])

    await syncCrm([lj], run)
    const rows = await rowsFor(doctor)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, old)
    assert.equal(rows[0].sales_id, lj)
    assert.equal(rows[0].status, 'contacted', 'the more recent edit wins')
    assert.equal(rows[0].account_type, 'OEM')
    assert.equal(rows[0].notes, 'Prefers WhatsApp\n\nAsked for price list')
    assert.equal((await db.query('SELECT * FROM crm_activities WHERE crm_doctor_id = $1', [old])).rows.length, 1)
  })

  await t.test('a doctor served by two reps keeps a record for each', async () => {
    const doctor = await user('dr-two', 'doctor', 'two@clinic.sg')
    await db.query('INSERT INTO sales_doctor_assignments (sales_id, doctor_id) VALUES ($1, $3), ($2, $3)', [germain, third, doctor])
    await syncCrm(undefined, run)
    await syncCrm(undefined, run)
    assert.deepEqual((await rowsFor(doctor)).map((row) => row.sales_id).sort(), [germain, third].sort())
  })

  await t.test('a moved doctor with no new rep keeps the old record', async () => {
    const doctor = await user('dr-unassigned', 'doctor', 'none@clinic.sg')
    await setDoctorSales([doctor], germain, null, { moveOrders: false }, run)
    await setDoctorSales([doctor], null, null, { moveOrders: false }, run)
    await syncCrm(undefined, run)
    const rows = await rowsFor(doctor)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].sales_id, germain)
  })
})
