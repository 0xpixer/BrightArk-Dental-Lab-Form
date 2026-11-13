import assert from 'node:assert/strict'
import test from 'node:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import {
  buildFinanceScope,
  canManageFinance,
  canViewFinance,
  computeFinanceTotal,
  displayFinanceTotal,
  financeRowSchema,
  financeRowValues,
  isAllowedInvoiceUrl,
  isFinanceOverdue,
  parseOverdueDays,
  resolveFinanceDueDate,
} from './finance'

const dialect = new PgDialect()

test('Total Amount is Original Price × (1 − Discount)', () => {
  assert.equal(computeFinanceTotal('1000', '10%'), 900)
  assert.equal(computeFinanceTotal('1,250.50', '20'), 1000.4)
  assert.equal(computeFinanceTotal('12000000', null), 12000000)
  assert.equal(computeFinanceTotal('100', '100%'), 0)
  assert.equal(computeFinanceTotal('99.99', '33.333%'), 66.66)
  assert.equal(computeFinanceTotal(null, '10%'), null)
  assert.equal(computeFinanceTotal('', '10%'), null)
})

test('legacy rows without an Original Price fall back to the imported Total Amount', () => {
  assert.equal(displayFinanceTotal({ originalPrice: null, discount: null, totalAmount: '4,500' }), 4500)
  assert.equal(displayFinanceTotal({ originalPrice: '5000', discount: '10%', totalAmount: '1' }), 4500)
})

test('saved rows always derive the Total Amount on the server', () => {
  const input = financeRowSchema.parse({ patientName: 'A', category: 'Dental Lab', paymentStatus: 'Unpaid', originalPrice: '2000', discount: '25', totalAmount: '1' })
  const values = financeRowValues(input)
  assert.equal(values.discount, '25%')
  assert.equal(values.totalAmount, '1500')
  assert.equal('totalAmount' in input, false)
})

test('rejects unsafe payment links and discounts outside 0–100%', () => {
  assert.equal(financeRowSchema.safeParse({ patientName: 'A', category: 'iAlign', paymentStatus: 'Paid', paymentLink: 'javascript:alert(1)' }).success, false)
  assert.equal(financeRowSchema.safeParse({ patientName: 'A', category: 'iAlign', paymentStatus: 'Paid', discount: '120' }).success, false)
  assert.equal(financeRowSchema.safeParse({ patientName: 'A', category: 'iAlign', paymentStatus: 'Paid', paymentLink: 'https://pay.example.com/x' }).success, true)
})

test('invoice files must be finance uploads in Vercel Blob', () => {
  assert.equal(isAllowedInvoiceUrl(null), true)
  assert.equal(isAllowedInvoiceUrl('https://abc.public.blob.vercel-storage.com/finance-invoices/1-inv.pdf'), true)
  assert.equal(isAllowedInvoiceUrl('https://abc.public.blob.vercel-storage.com/idesign/x.pdf'), false)
  assert.equal(isAllowedInvoiceUrl('https://evil.example.com/finance-invoices/x.pdf'), false)
})

test('due date is the row Due Date, else Invoice Date plus the overdue days', () => {
  assert.equal(resolveFinanceDueDate({ dueDate: '2026-12-01', invoiceDate: '2026-01-01' }, 30), '2026-12-01')
  assert.equal(resolveFinanceDueDate({ dueDate: null, invoiceDate: '2026-01-15' }, 30), '2026-02-14')
  assert.equal(resolveFinanceDueDate({ dueDate: null, invoiceDate: null }, 30), null)
})

test('only invoiced Unpaid rows past their due date are overdue', () => {
  const today = '2026-03-01'
  assert.equal(isFinanceOverdue({ paymentStatus: 'Unpaid', invoiceDate: '2026-01-15', dueDate: null }, 30, today), true)
  assert.equal(isFinanceOverdue({ paymentStatus: 'Unpaid', invoiceDate: '2026-01-31', dueDate: null }, 30, today), false)
  assert.equal(isFinanceOverdue({ paymentStatus: 'Unpaid', invoiceDate: '2026-01-30', dueDate: null }, 30, today), false, 'due today is not overdue yet')
  assert.equal(isFinanceOverdue({ paymentStatus: 'Unpaid', invoiceDate: '2026-01-01', dueDate: '2026-04-01' }, 30, today), false)
  assert.equal(isFinanceOverdue({ paymentStatus: 'Unpaid', invoiceDate: null, dueDate: null }, 30, today), false)
  for (const status of ['Paid', 'Free', 'Invoice not issue']) {
    assert.equal(isFinanceOverdue({ paymentStatus: status, invoiceDate: '2025-01-01', dueDate: null }, 30, today), false)
  }
})

test('overdue days setting falls back to 30 for invalid values', () => {
  assert.equal(parseOverdueDays('45'), 45)
  assert.equal(parseOverdueDays('0'), 0)
  assert.equal(parseOverdueDays('-3'), 30)
  assert.equal(parseOverdueDays('abc'), 30)
  assert.equal(parseOverdueDays(null), 30)
})

test('finance visibility and edit rights by role', () => {
  for (const role of ['superadmin', 'admin', 'sales', 'sales_director', 'doctor', 'clinic_staff']) assert.equal(canViewFinance(role), true, role)
  for (const role of ['treatment_designer', '', 'unknown']) assert.equal(canViewFinance(role), false, role)
  assert.equal(canManageFinance('admin'), true)
  assert.equal(canManageFinance('superadmin'), true)
  for (const role of ['sales', 'sales_director', 'doctor', 'clinic_staff']) assert.equal(canManageFinance(role), false, role)
})

test('admins see every row; doctors and clinic staff only their doctor', () => {
  assert.equal(buildFinanceScope({ role: 'admin' }), undefined)
  assert.equal(buildFinanceScope({ role: 'superadmin' }), undefined)
  for (const role of ['doctor', 'clinic_staff']) {
    const query = dialect.sqlToQuery(buildFinanceScope({ role, ownerId: 7 })!)
    assert.equal(query.sql, '"idesign_orders"."doctor_account_id" in ($1)')
    assert.deepEqual(query.params, [7])
  }
  assert.equal(dialect.sqlToQuery(buildFinanceScope({ role: 'clinic_staff', ownerId: null })!).sql, 'false')
})

test('sales see assigned doctors and their own sales rows; directors include their reps', () => {
  const sales = dialect.sqlToQuery(buildFinanceScope({ role: 'sales', salesIds: [3], doctorIds: [7, 8] })!)
  assert.equal(sales.sql, '("idesign_orders"."doctor_account_id" in ($1, $2) or "idesign_orders"."sales_account_id" in ($3))')
  assert.deepEqual(sales.params, [7, 8, 3])
  const director = dialect.sqlToQuery(buildFinanceScope({ role: 'sales_director', salesIds: [5, 3, 4], doctorIds: [] })!)
  assert.equal(director.sql, '"idesign_orders"."sales_account_id" in ($1, $2, $3)')
  assert.equal(dialect.sqlToQuery(buildFinanceScope({ role: 'sales', salesIds: [], doctorIds: [] })!).sql, 'false')
  assert.equal(dialect.sqlToQuery(buildFinanceScope({ role: 'treatment_designer' })!).sql, 'false')
})
