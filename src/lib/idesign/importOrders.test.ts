import assert from 'node:assert/strict'
import test from 'node:test'
import type { IDesignOrder } from '@/lib/db/schema'
import { buildIDesignImportPreview, importValuesForChange, parseIDesignImportSheet, sourceKeyForImport } from './importOrders'

const header = [
  'Sales', 'Country', 'Patient Name', 'Update Time', 'Creation Time', 'Doctor', 'Latest Progress', 'Category',
  'Purchased Products', 'Currency-Original Price', 'Original Price', 'Discount', 'Total Amount', 'Actual payment Currency',
  'Actual payment (after fees)', 'Payment Status', 'Invoice No.', 'Invoice Date', 'Payment Date', 'Shipped Date',
  'Tracking No.', 'Delivered Date', 'Total Steps', 'Produced Steps', 'Sales Commision Rate', 'Attribute to Month', 'Sales Commision',
]

function sourceRow(overrides: Record<number, unknown> = {}) {
  const row: unknown[] = [
    'Germain Ho', 'Singapore', 'Patient One', '02/11/2026', '01/10/2026', 'Doctor One', 'In Production', 'iAlign',
    'iAlign 10 Dual', 'SGD', '1000', '10%', '900', 'SGD', '880', 'Paid', 'INV-1', '02/10/2026', '03/10/2026',
    '04/10/2026', 'TRACK-1', '05/10/2026', '10', '1-5', '5%', 'October', '44',
  ]
  for (const [index, value] of Object.entries(overrides)) row[Number(index)] = value
  return row
}

function existingOrder(overrides: Partial<IDesignOrder> = {}): IDesignOrder {
  return {
    id: 7,
    sourceKey: 'legacy-source',
    salespersonName: 'Germain Ho',
    salesAccountId: 20,
    country: 'Singapore',
    patientName: 'Patient One',
    sourceUpdatedOn: '2026-10-01',
    sourceCreatedOn: '2026-10-01',
    doctorName: 'Doctor One',
    doctorAccountId: 30,
    latestProgress: 'Entering Info',
    category: 'iAlign',
    purchasedProducts: 'iAlign 10 Dual',
    originalCurrency: 'SGD',
    originalPrice: '1000',
    discount: '10%',
    totalAmount: '900',
    paymentCurrency: 'SGD',
    actualPayment: '880',
    paymentStatus: 'Paid',
    invoiceNo: 'INV-1',
    invoiceDate: '2026-10-02',
    paymentDate: '2026-10-03',
    shippedDate: '2026-10-04',
    trackingNo: 'TRACK-1',
    deliveredDate: '2026-10-05',
    totalSteps: '10',
    producedSteps: '1-5',
    salesCommissionRate: '5%',
    attributedMonth: 'October',
    salesCommission: '44',
    assignmentUpdatedBy: 1,
    assignmentUpdatedAt: new Date('2026-10-01T00:00:00Z'),
    createdBy: 1,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    ...overrides,
  }
}

test('parses the original Lark spreadsheet headers and day-first dates', () => {
  const result = parseIDesignImportSheet([header, sourceRow()])
  assert.deepEqual(result.issues, [])
  assert.equal(result.rows[0].data.sourceUpdatedOn, '2026-11-02')
  assert.equal(result.rows[0].data.invoiceDate, '2026-10-02')
  assert.equal(result.rows[0].data.salesCommissionRate, '5%')
})

test('matches by patient, doctor, creation time and category and reports only source-owned field changes', () => {
  const parsed = parseIDesignImportSheet([header, sourceRow()])
  const preview = buildIDesignImportPreview(parsed.rows, [existingOrder()], parsed.issues)
  assert.equal(preview.summary.updatedRows, 1)
  assert.deepEqual(preview.changes[0].changes.map((change) => change.field).sort(), ['latestProgress', 'sourceUpdatedOn'])
  const values = importValuesForChange(parsed.rows[0], preview.changes[0])
  assert.equal(values.latestProgress, 'In Production')
  assert.equal('doctorAccountId' in values, false)
  assert.equal('salesAccountId' in values, false)
})

test('creates deterministic source keys without a Case ID column', () => {
  const parsed = parseIDesignImportSheet([header, sourceRow()])
  const preview = buildIDesignImportPreview(parsed.rows, [existingOrder()], parsed.issues)
  assert.equal(preview.summary.updatedRows, 1)
  assert.equal(sourceKeyForImport(parsed.rows[0]), sourceKeyForImport(parsed.rows[0]))
})

test('does not overwrite a record with an older spreadsheet row', () => {
  const parsed = parseIDesignImportSheet([header, sourceRow({ 3: '01/09/2026' })])
  const preview = buildIDesignImportPreview(parsed.rows, [existingOrder()], parsed.issues)
  assert.equal(preview.summary.staleRows, 1)
  assert.equal(preview.summary.updatedRows, 0)
  assert.equal(preview.canApply, true)
})

test('blocks duplicate rows in the uploaded workbook', () => {
  const parsed = parseIDesignImportSheet([header, sourceRow(), sourceRow()])
  const preview = buildIDesignImportPreview(parsed.rows, [], parsed.issues)
  assert.equal(preview.summary.conflictRows, 1)
  assert.equal(preview.canApply, false)
})

test('does not double-count a row that conflicts with duplicate existing match fields', () => {
  const parsed = parseIDesignImportSheet([header, sourceRow()])
  const preview = buildIDesignImportPreview(parsed.rows, [existingOrder(), existingOrder({ id: 8 })], parsed.issues)
  assert.equal(preview.summary.totalRows, 1)
  assert.equal(preview.summary.conflictRows, 1)
})

test('accepts legacy year-first timestamps and blank patient names for non-aligner records', () => {
  const parsed = parseIDesignImportSheet([header, sourceRow({ 2: '', 7: 'Others', 21: '2026/08/10 00:00' })])
  assert.deepEqual(parsed.issues, [])
  assert.equal(parsed.rows[0].data.patientName, '-')
  assert.equal(parsed.rows[0].data.deliveredDate, '2026-08-10')
})

test('reports unsupported currencies instead of silently clearing them', () => {
  const parsed = parseIDesignImportSheet([header, sourceRow({ 9: 'USD' })])
  assert.equal(parsed.rows.length, 0)
  assert.match(parsed.issues[0].message, /Currency - Original Price/)
})
