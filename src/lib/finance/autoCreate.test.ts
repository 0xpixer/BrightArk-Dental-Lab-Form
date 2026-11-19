import assert from 'node:assert/strict'
import test from 'node:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import { buildCaseFinanceRow, buildDentalOrderFinanceRow } from './autoCreate'
import { financeOrderHref, financeTabCategories, financeTabForCategory, financeTabHref, parseFinanceTab } from './calc'
import { importedOrderRecordsOnly } from '@/lib/idesign/importedCases'

const doctor = { id: 7, fullName: 'Dr. Budi', username: 'budi', country: 'Indonesia' }
const sales = { id: 3, fullName: null, username: 'anisa' }

test('a new aligner case pre-fills a linked, not-yet-invoiced iAlign Finance row', () => {
  const row = buildCaseFinanceRow({ id: 41, orderNo: 'IDS-20261119-0001', patientName: 'Siti', doctorAccountId: 7, salesAccountId: 3, createdBy: 9, createdAt: new Date('2026-11-19T10:00:00Z') }, doctor, sales)
  assert.equal(row.caseId, 41)
  assert.equal(row.dentalOrderId, undefined)
  assert.equal(row.orderNo, 'IDS-20261119-0001')
  assert.equal(row.patientName, 'Siti')
  assert.equal(row.category, 'iAlign')
  assert.equal(row.paymentStatus, 'Invoice not issue')
  assert.equal(row.doctorAccountId, 7)
  assert.equal(row.doctorName, 'Dr. Budi')
  assert.equal(row.salesAccountId, 3)
  assert.equal(row.salespersonName, 'anisa')
  assert.equal(row.country, 'Indonesia')
  assert.equal(row.sourceCreatedOn, '2026-11-19')
  assert.equal(row.originalPrice, undefined, 'prices are left for admin')
  assert.equal(row.discount, undefined)
  assert.equal(row.totalAmount, undefined)
})

test('cases without a doctor or sales yet still get a Finance row with placeholders', () => {
  const row = buildCaseFinanceRow({ id: 42, orderNo: 'IDS-2', patientName: 'Lee', doctorAccountId: null, salesAccountId: null, createdBy: 1, createdAt: new Date('2026-11-19T00:00:00Z') }, null, null)
  assert.equal(row.doctorAccountId, null)
  assert.equal(row.doctorName, '-')
  assert.equal(row.salespersonName, '-')
  assert.equal(row.country, '-')
})

test('a new Dental Lab order pre-fills a linked Dental Lab Finance row with its treatment', () => {
  const row = buildDentalOrderFinanceRow({ id: 88, orderNo: 'BA-20261119-003', patientName: 'Anong', treatmentType: 'Crown & Bridge', submittedBy: 7, createdAt: new Date('2026-11-19T23:30:00Z') }, doctor, sales, 3)
  assert.equal(row.dentalOrderId, 88)
  assert.equal(row.caseId, undefined)
  assert.equal(row.category, 'Dental Lab')
  assert.equal(row.purchasedProducts, 'Crown & Bridge')
  assert.equal(row.orderNo, 'BA-20261119-003')
  assert.equal(row.paymentStatus, 'Invoice not issue')
  assert.equal(row.doctorAccountId, 7)
  assert.equal(row.salesAccountId, 3)
  assert.equal(row.createdBy, 3)
  assert.equal(row.sourceCreatedOn, '2026-11-19')
})

test('Finance tabs: Clear Aligners, Dental Lab, and Devices & Service for everything else', () => {
  assert.deepEqual(financeTabCategories('aligners'), ['iAlign'])
  assert.deepEqual(financeTabCategories('dental'), ['Dental Lab'])
  assert.deepEqual(financeTabCategories('devices'), ['iScan', 'Others'])
  assert.equal(financeTabForCategory('Some new category'), 'devices')
  assert.equal(parseFinanceTab('dental'), 'dental')
  assert.equal(parseFinanceTab('devices'), 'devices')
  assert.equal(parseFinanceTab('overview'), 'overview')
  assert.deepEqual(financeTabCategories('overview'), ['iAlign', 'iScan', 'Dental Lab', 'Others'])
  assert.equal(parseFinanceTab(null), 'aligners')
  assert.equal(parseFinanceTab('anything'), 'aligners')
})

test('Finance tab links only carry a tab parameter for the non-default tabs', () => {
  assert.equal(financeTabHref('/admin/finance', 'aligners'), '/admin/finance')
  assert.equal(financeTabHref('/admin/finance', 'devices'), '/admin/finance?tab=devices')
  assert.equal(financeTabHref('/admin/finance', 'overview'), '/admin/finance?tab=overview')
  assert.equal(financeTabHref('/portal/finance', 'dental', true), '/portal/finance?tab=dental&overdue=1')
  assert.equal(financeTabHref('/admin/finance', undefined, true), '/admin/finance?overdue=1')
})

test('Finance rows link to their order in the admin dashboard and the doctor portal', () => {
  assert.equal(financeOrderHref({ caseId: 41, dentalOrderId: null }, 'admin'), '/admin/idesign/orders/41')
  assert.equal(financeOrderHref({ caseId: 41, dentalOrderId: null }, 'portal'), '/portal/idesign/orders/41')
  assert.equal(financeOrderHref({ caseId: null, dentalOrderId: 88 }, 'admin'), '/admin/submissions/88')
  assert.equal(financeOrderHref({ caseId: null, dentalOrderId: 88 }, 'portal'), '/portal/orders/88')
  assert.equal(financeOrderHref({ caseId: null, dentalOrderId: null }, 'admin'), null)
})

test('imported-only paths exclude Finance rows auto-created for cases and Dental Lab orders', () => {
  const query = new PgDialect().sqlToQuery(importedOrderRecordsOnly)
  assert.equal(query.sql, '("idesign_orders"."case_id" is null and "idesign_orders"."dental_order_id" is null)')
})
