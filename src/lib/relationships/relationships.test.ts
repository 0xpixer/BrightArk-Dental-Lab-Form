import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { findRelationshipIssues, matchSalesReferral } from './issues'
import { adoptOrderSales, fixRelationshipIssues, loadOrderSalesLinks, setDoctorSales, type RelationshipExecutor } from './server'
import { unassignedDoctorEmail } from './notify'

test('issues: unassigned with orders, missing sales and other sales', () => {
  const doctorSales = new Map<number, number | null>([[1, null], [2, 20], [3, 20], [4, null], [5, 20]])
  const issues = findRelationshipIssues(doctorSales, [
    { doctorId: 1, salesId: 21, count: 1 }, { doctorId: 1, salesId: 20, count: 3 }, { doctorId: 1, salesId: null, count: 2 },
    { doctorId: 2, salesId: null, count: 2 }, { doctorId: 2, salesId: 20, count: 1 },
    { doctorId: 3, salesId: 22, count: 1 }, { doctorId: 3, salesId: 21, count: 2 },
    { doctorId: 4, salesId: null, count: 5 },
    { doctorId: 5, salesId: 20, count: 4 },
    { doctorId: 99, salesId: 20, count: 1 },
  ])
  assert.deepEqual(issues, [
    { kind: 'unassigned_with_orders', doctorId: 1, salesId: 20, orderCount: 4 },
    { kind: 'orders_missing_sales', doctorId: 2, salesId: 20, orderCount: 2 },
    { kind: 'orders_other_sales', doctorId: 3, salesId: 20, otherSalesIds: [21, 22], orderCount: 3 },
  ])
})

test('sign-up referral matches one sales account or none', () => {
  const sales = [
    { id: 20, name: 'Puji adelina siahaan', username: 'puji@thebrightark.com', email: 'puji@thebrightark.com' },
    { id: 21, name: 'Andi Wijaya', username: 'andi.w', email: null },
    { id: 22, name: 'Andi Pratama', username: 'andi.p', email: null },
  ]
  assert.equal(matchSalesReferral('Puji', sales), 20)
  assert.equal(matchSalesReferral('puji@thebrightark.com', sales), 20)
  assert.equal(matchSalesReferral('Ms. Adelina', sales), 20)
  assert.equal(matchSalesReferral('Andi', sales), null)
  assert.equal(matchSalesReferral('Andi Wijaya', sales), 21)
  assert.equal(matchSalesReferral('', sales), null)
  assert.equal(matchSalesReferral('someone else', sales), null)
})

test('unassigned doctor email names the referral and links to the page', () => {
  const email = unassignedDoctorEmail({ fullName: 'Dr B', username: 'b@x.com', clinicName: 'Gigi', country: 'Indonesia', city: 'Jakarta', salesReferral: 'Puji' }, 'https://app/admin/accounts?tab=relationships')
  assert.equal(email.subject, 'New doctor without a sales rep: Dr B')
  assert.match(email.text, /Sales rep named at sign-up: Puji/)
  assert.match(email.text, /Location: Jakarta, Indonesia/)
  assert.match(email.text, /Assign a sales rep: https:\/\/app/)
})

test('relationship writes on isolated in-memory Postgres', async (t) => {
  // Never touches DATABASE_URL: every migration runs against an in-memory database.
  const db = new PGlite()
  t.after(() => db.close())
  const migrations = new URL('../../../drizzle/', import.meta.url)
  for (const file of (await readdir(migrations)).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(file, migrations), 'utf8'))
  }
  const dialect = new PgDialect()
  const run: RelationshipExecutor = async <T,>(query: SQL) => {
    const { sql: text, params } = dialect.sqlToQuery(query)
    return (await db.query<T>(text, params)).rows
  }
  const user = async (username: string, role: string, fullName = username) => (await db.query<{ id: number }>(
    `INSERT INTO admin_users (username, email, role, password_hash, full_name) VALUES ($1, $1, $2, 'x', $3) RETURNING id`, [username, role, fullName],
  )).rows[0].id
  const salesA = await user('a@x.com', 'sales', 'Sales A')
  const salesB = await user('b@x.com', 'sales', 'Sales B')
  const doctor = await user('doc@x.com', 'doctor')
  const other = await user('other@x.com', 'doctor')
  const kase = async (doctorId: number, salesId: number | null) => (await db.query<{ id: number }>(
    `INSERT INTO idesign_cases (order_no, order_type, patient_name, latest_progress, doctor_account_id, sales_account_id) VALUES ('N' || floor(random()*1e9)::text, 'clear_aligner', 'P', 'Lab Designing', $1, $2) RETURNING id`, [doctorId, salesId],
  )).rows[0].id
  const financeRow = async (doctorId: number, salesId: number | null, caseId: number | null) => db.query(
    `INSERT INTO idesign_orders (doctor_account_id, sales_account_id, case_id, salesperson_name, doctor_name, patient_name, country, latest_progress, category, payment_status) VALUES ($1, $2, $3, '-', 'D', 'P', '-', 'Entering Info', 'iAlign', 'Unpaid')`, [doctorId, salesId, caseId],
  )
  const salesOf = async (table: string, doctorId: number) => (await db.query<{ sales_account_id: number | null }>(`SELECT sales_account_id FROM ${table} WHERE doctor_account_id = $1 ORDER BY id`, [doctorId])).rows.map((row) => row.sales_account_id)
  const assignments = async (doctorId: number) => (await db.query<{ sales_id: number }>(`SELECT sales_id FROM sales_doctor_assignments WHERE doctor_id = $1 ORDER BY sales_id`, [doctorId])).rows.map((row) => row.sales_id)

  // An unassigned doctor whose case names Sales A: the case and its Finance row count once.
  const caseId = await kase(doctor, salesA)
  await financeRow(doctor, salesA, caseId)
  await financeRow(doctor, null, null)
  assert.deepEqual((await loadOrderSalesLinks(run)).sort((a, b) => (a.salesId ?? 0) - (b.salesId ?? 0)), [
    { doctorId: doctor, salesId: null, count: 1 }, { doctorId: doctor, salesId: salesA, count: 1 },
  ])

  // Adopting never replaces an existing rep.
  assert.equal(await adoptOrderSales(doctor, salesA, null, run), true)
  assert.equal(await adoptOrderSales(doctor, salesB, null, run), false)
  assert.deepEqual(await assignments(doctor), [salesA])
  const crm = await db.query<{ sales_id: number }>(`SELECT sales_id FROM crm_doctors WHERE doctor_account_id = $1`, [doctor])
  assert.deepEqual(crm.rows.map((row) => row.sales_id), [salesA])

  // Fixing fills the Finance row that had no sales rep.
  const doctorSales = new Map<number, number | null>([[doctor, salesA], [other, null]])
  const issues = findRelationshipIssues(doctorSales, await loadOrderSalesLinks(run))
  assert.deepEqual(issues.map((issue) => issue.kind), ['orders_missing_sales'])
  await fixRelationshipIssues(issues, null, run)
  assert.deepEqual(await salesOf('idesign_orders', doctor), [salesA, salesA])
  assert.equal((await db.query<{ salesperson_name: string }>(`SELECT salesperson_name FROM idesign_orders WHERE case_id IS NULL AND doctor_account_id = $1`, [doctor])).rows[0].salesperson_name, 'Sales A')

  // Moving the doctor to Sales B replaces the rep and moves every order with them.
  const { moved } = await setDoctorSales([doctor], salesB, null, { moveOrders: true }, run)
  assert.equal(moved, 3)
  assert.deepEqual(await assignments(doctor), [salesB])
  assert.deepEqual(await salesOf('idesign_cases', doctor), [salesB])
  assert.deepEqual(await salesOf('idesign_orders', doctor), [salesB, salesB])

  // Without moveOrders the orders stay; unassigning leaves orders untouched.
  await setDoctorSales([doctor], salesA, null, { moveOrders: false }, run)
  assert.deepEqual(await salesOf('idesign_cases', doctor), [salesB])
  await setDoctorSales([doctor], null, null, { moveOrders: true }, run)
  assert.deepEqual(await assignments(doctor), [])
  assert.deepEqual(await salesOf('idesign_cases', doctor), [salesB])

  // Non-doctor accounts are never assigned.
  await setDoctorSales([salesA], salesB, null, { moveOrders: false }, run)
  assert.deepEqual(await assignments(salesA), [])
})
