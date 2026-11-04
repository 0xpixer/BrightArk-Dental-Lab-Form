import { createHash } from 'node:crypto'
import type { IDesignOrder } from '@/lib/db/schema'
import {
  createIDesignOrderSchema,
  IDESIGN_CATEGORIES,
  IDESIGN_COUNTRIES,
  IDESIGN_CURRENCIES,
  IDESIGN_PAYMENT_STATUSES,
  IDESIGN_PROGRESS_OPTIONS,
  IDESIGN_SALES_COUNTRY,
  type CreateIDesignOrderInput,
} from './orders'

const MAX_IMPORT_ROWS = 2000

const FIELD_DEFINITIONS = [
  ['salespersonName', 'Sales', ['sales', 'salesperson', 'sales person']],
  ['country', 'Country', ['country', 'market']],
  ['patientName', 'Patient Name', ['patient name', 'patient']],
  ['sourceUpdatedOn', 'Update Time', ['update time', 'updated time', 'updated on', 'update date']],
  ['sourceCreatedOn', 'Creation Time', ['creation time', 'created time', 'created on', 'creation date']],
  ['doctorName', 'Doctor', ['doctor', 'doctor name']],
  ['latestProgress', 'Latest Progress', ['latest progress', 'progress', 'status']],
  ['category', 'Category', ['category', 'order category']],
  ['purchasedProducts', 'Purchased Products', ['purchased products', 'products', 'product']],
  ['originalCurrency', 'Currency - Original Price', ['currency original price', 'original price currency', 'original currency']],
  ['originalPrice', 'Original Price', ['original price']],
  ['discount', 'Discount', ['discount']],
  ['totalAmount', 'Total Amount', ['total amount']],
  ['paymentCurrency', 'Actual Payment Currency', ['actual payment currency', 'payment currency']],
  ['actualPayment', 'Actual Payment (After Fees)', ['actual payment after fees', 'actual payment', 'payment after fees']],
  ['paymentStatus', 'Payment Status', ['payment status']],
  ['invoiceNo', 'Invoice No.', ['invoice no', 'invoice number']],
  ['invoiceDate', 'Invoice Date', ['invoice date']],
  ['paymentDate', 'Payment Date', ['payment date']],
  ['shippedDate', 'Shipped Date', ['shipped date', 'shipping date']],
  ['trackingNo', 'Tracking No.', ['tracking no', 'tracking number']],
  ['deliveredDate', 'Delivered Date', ['delivered date', 'delivery date']],
  ['totalSteps', 'Total Steps', ['total steps']],
  ['producedSteps', 'Produced Steps', ['produced steps']],
  ['salesCommissionRate', 'Sales Commission Rate', ['sales commission rate', 'sales commision rate']],
  ['attributedMonth', 'Attribute to Month', ['attribute to month', 'attributed month']],
  ['salesCommission', 'Sales Commission', ['sales commission', 'sales commision']],
] as const

export type ImportField = (typeof FIELD_DEFINITIONS)[number][0]

const REQUIRED_FIELDS: ImportField[] = [
  'salespersonName',
  'country',
  'patientName',
  'sourceUpdatedOn',
  'sourceCreatedOn',
  'doctorName',
  'latestProgress',
  'category',
  'paymentStatus',
]

const DATE_FIELDS = new Set<ImportField>([
  'sourceUpdatedOn',
  'sourceCreatedOn',
  'invoiceDate',
  'paymentDate',
  'shippedDate',
  'deliveredDate',
])

const PERCENT_FIELDS = new Set<ImportField>([
  'discount',
  'salesCommissionRate',
])

const OPTIONAL_NULLABLE_FIELDS = new Set<ImportField>([
  'purchasedProducts',
  'originalCurrency',
  'originalPrice',
  'discount',
  'totalAmount',
  'paymentCurrency',
  'actualPayment',
  'invoiceNo',
  'invoiceDate',
  'paymentDate',
  'shippedDate',
  'trackingNo',
  'deliveredDate',
  'totalSteps',
  'producedSteps',
  'salesCommissionRate',
  'attributedMonth',
  'salesCommission',
])

const FIELD_LABELS = Object.fromEntries(FIELD_DEFINITIONS.map(([field, label]) => [field, label])) as Record<ImportField, string>
const HEADER_FIELDS = new Map<string, ImportField>()
for (const [field, label, aliases] of FIELD_DEFINITIONS) {
  for (const alias of [label, ...aliases]) HEADER_FIELDS.set(normalizeHeader(alias), field)
}

export interface ParsedImportRow {
  rowNumber: number
  data: CreateIDesignOrderInput
  presentFields: ImportField[]
  matchKey: string
}

export interface ImportIssue {
  rowNumber: number
  message: string
  type: 'error' | 'conflict' | 'stale'
}

export interface ImportFieldChange {
  field: ImportField
  label: string
  from: string | null
  to: string | null
}

export interface ImportChange {
  rowNumber: number
  action: 'create' | 'update'
  existingId: number | null
  patientName: string
  doctorName: string
  changes: ImportFieldChange[]
}

export interface ImportPreview {
  summary: {
    totalRows: number
    newRows: number
    updatedRows: number
    unchangedRows: number
    staleRows: number
    errorRows: number
    conflictRows: number
  }
  changes: ImportChange[]
  issues: ImportIssue[]
  canApply: boolean
  detailsTruncated: boolean
  parsedRows: ParsedImportRow[]
}

export function parseIDesignImportSheet(rows: unknown[][]): { rows: ParsedImportRow[]; issues: ImportIssue[] } {
  const compactRows = rows.filter((row) => row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ''))
  if (compactRows.length === 0) return { rows: [], issues: [{ rowNumber: 1, message: 'The workbook is empty', type: 'error' }] }
  if (compactRows.length - 1 > MAX_IMPORT_ROWS) {
    return { rows: [], issues: [{ rowNumber: 1, message: `A workbook can contain at most ${MAX_IMPORT_ROWS} data rows`, type: 'error' }] }
  }

  const header = compactRows[0]
  const columns = new Map<ImportField, number>()
  const duplicateHeaders: string[] = []
  header.forEach((value, index) => {
    const field = HEADER_FIELDS.get(normalizeHeader(cellText(value)))
    if (!field) return
    if (columns.has(field)) duplicateHeaders.push(FIELD_LABELS[field])
    else columns.set(field, index)
  })
  const missing = REQUIRED_FIELDS.filter((field) => !columns.has(field)).map((field) => FIELD_LABELS[field])
  if (missing.length || duplicateHeaders.length) {
    const issues: ImportIssue[] = []
    if (missing.length) issues.push({ rowNumber: 1, message: `Missing required columns: ${missing.join(', ')}`, type: 'error' })
    if (duplicateHeaders.length) issues.push({ rowNumber: 1, message: `Duplicate columns: ${duplicateHeaders.join(', ')}`, type: 'error' })
    return { rows: [], issues }
  }

  const parsedRows: ParsedImportRow[] = []
  const issues: ImportIssue[] = []
  const seenKeys = new Map<string, number>()
  const presentFields = [...columns.keys()]

  compactRows.slice(1).forEach((row, dataIndex) => {
    const rowNumber = dataIndex + 2
    const raw: Record<string, unknown> = {}
    for (const [field, columnIndex] of columns) {
      const value = row[columnIndex]
      raw[field] = DATE_FIELDS.has(field)
        ? parseDateCell(value)
        : PERCENT_FIELDS.has(field)
          ? parsePercentCell(value)
          : cellTextOrNull(value)
    }

    raw.country = canonicalValue(raw.country, IDESIGN_COUNTRIES)
      ?? IDESIGN_SALES_COUNTRY[cellText(raw.salespersonName)]
      ?? cellTextOrNull(raw.country)
    raw.category = canonicalValue(raw.category, IDESIGN_CATEGORIES) ?? cellTextOrNull(raw.category)
    if (!raw.patientName && raw.category !== 'iAlign') raw.patientName = '-'
    raw.latestProgress = canonicalProgress(raw.latestProgress)
    raw.paymentStatus = canonicalPaymentStatus(raw.paymentStatus)
    raw.originalCurrency = canonicalValue(raw.originalCurrency, IDESIGN_CURRENCIES) ?? cellTextOrNull(raw.originalCurrency)
    raw.paymentCurrency = canonicalValue(raw.paymentCurrency, IDESIGN_CURRENCIES) ?? cellTextOrNull(raw.paymentCurrency)

    for (const field of OPTIONAL_NULLABLE_FIELDS) {
      if (!columns.has(field)) delete raw[field]
    }

    const parsed = createIDesignOrderSchema.safeParse(raw)
    if (!parsed.success) {
      issues.push({
        rowNumber,
        message: parsed.error.issues.map((issue) => `${FIELD_LABELS[issue.path[0] as ImportField] ?? issue.path[0] ?? 'Row'}: ${issue.message}`).join('; '),
        type: 'error',
      })
      return
    }

    const matchKey = importMatchKey(parsed.data)
    if (!matchKey) {
      issues.push({ rowNumber, message: 'Patient Name, Doctor, Creation Time and Category are required to match imported records safely', type: 'error' })
      return
    }
    const duplicateAt = seenKeys.get(matchKey)
    if (duplicateAt) {
      issues.push({ rowNumber, message: `This record duplicates row ${duplicateAt} in the uploaded workbook`, type: 'conflict' })
      return
    }
    seenKeys.set(matchKey, rowNumber)
    parsedRows.push({ rowNumber, data: parsed.data, presentFields, matchKey })
  })

  return { rows: parsedRows, issues }
}

export function buildIDesignImportPreview(parsedRows: ParsedImportRow[], existingRows: IDesignOrder[], parseIssues: ImportIssue[] = []): ImportPreview {
  const byFallback = groupExisting(existingRows, (row) => fallbackMatchKey(row))
  const changes: ImportChange[] = []
  const issues = [...parseIssues]
  let unchangedRows = 0
  let staleRows = 0
  let conflictRows = parseIssues.filter((issue) => issue.type === 'conflict').length

  for (const row of parsedRows) {
    const fallbackMatches = byFallback.get(fallbackMatchKey(row.data)!) ?? []
    let existing: IDesignOrder | undefined

    if (fallbackMatches.length > 1) {
      issues.push({ rowNumber: row.rowNumber, message: 'Multiple existing records match the Patient, Doctor, Creation Time and Category', type: 'conflict' })
      conflictRows += 1
      continue
    } else if (fallbackMatches.length === 1) {
      existing = fallbackMatches[0]
    }

    if (!existing) {
      changes.push({
        rowNumber: row.rowNumber,
        action: 'create',
        existingId: null,
        patientName: row.data.patientName,
        doctorName: row.data.doctorName,
        changes: [],
      })
      continue
    }

    if (isIncomingOlder(row.data.sourceUpdatedOn, existing.sourceUpdatedOn)) {
      staleRows += 1
      issues.push({
        rowNumber: row.rowNumber,
        message: `Skipped because the uploaded Update Time (${row.data.sourceUpdatedOn}) is older than the current record (${existing.sourceUpdatedOn})`,
        type: 'stale',
      })
      continue
    }

    const fieldChanges = row.presentFields.flatMap((field): ImportFieldChange[] => {
      const from = comparableFieldValue(field, existing[field as keyof IDesignOrder])
      const to = comparableFieldValue(field, row.data[field as keyof CreateIDesignOrderInput])
      return from === to ? [] : [{ field, label: FIELD_LABELS[field], from, to }]
    })
    if (fieldChanges.length === 0) {
      unchangedRows += 1
      continue
    }
    changes.push({
      rowNumber: row.rowNumber,
      action: 'update',
      existingId: existing.id,
      patientName: row.data.patientName,
      doctorName: row.data.doctorName,
      changes: fieldChanges,
    })
  }

  const errorRows = issues.filter((issue) => issue.type === 'error').length
  const detailsTruncated = changes.length > 100 || issues.length > 100
  const rejectedInputRows = parseIssues.filter((issue) => issue.type === 'error' || issue.type === 'conflict').length
  return {
    summary: {
      totalRows: parsedRows.length + rejectedInputRows,
      newRows: changes.filter((change) => change.action === 'create').length,
      updatedRows: changes.filter((change) => change.action === 'update').length,
      unchangedRows,
      staleRows,
      errorRows,
      conflictRows,
    },
    changes,
    issues,
    canApply: errorRows === 0 && conflictRows === 0,
    detailsTruncated,
    parsedRows,
  }
}

export function importValuesForChange(row: ParsedImportRow, change: ImportChange) {
  if (change.action === 'create') {
    return {
      ...row.data,
      sourceKey: sourceKeyForImport(row),
    }
  }
  return {
    ...Object.fromEntries(change.changes.map(({ field }) => [field, row.data[field]])),
    sourceKey: sourceKeyForImport(row),
  } as Partial<CreateIDesignOrderInput> & { sourceKey: string }
}

export function sourceKeyForImport(row: ParsedImportRow) {
  return `excel-${createHash('sha256').update(row.matchKey).digest('hex').slice(0, 24)}`
}

function groupExisting(rows: IDesignOrder[], keyFor: (row: IDesignOrder) => string | null) {
  const grouped = new Map<string, IDesignOrder[]>()
  for (const row of rows) {
    const key = keyFor(row)
    if (!key) continue
    grouped.set(key, [...(grouped.get(key) ?? []), row])
  }
  return grouped
}

function importMatchKey(input: CreateIDesignOrderInput) {
  return fallbackMatchKey(input)
}

function fallbackMatchKey(input: Pick<CreateIDesignOrderInput, 'patientName' | 'doctorName' | 'sourceCreatedOn' | 'category'> | Pick<IDesignOrder, 'patientName' | 'doctorName' | 'sourceCreatedOn' | 'category'>) {
  if (!input.patientName || !input.doctorName || !input.sourceCreatedOn || !input.category) return null
  return `fallback:${normalizeIdentity(input.patientName)}|${normalizeIdentity(input.doctorName)}|${input.sourceCreatedOn}|${normalizeIdentity(input.category)}`
}

function normalizeIdentity(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeHeader(value: string) {
  return value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function cellText(value: unknown) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && value && 'text' in value) return String((value as { text: unknown }).text).trim()
  return String(value).trim()
}

function cellTextOrNull(value: unknown) {
  const text = cellText(value)
  return text || null
}

function parsePercentCell(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return cellTextOrNull(value)
  const percentage = Math.abs(value) <= 1 ? value * 100 : value
  return `${Number(percentage.toFixed(10))}%`
}

function canonicalValue<const T extends readonly string[]>(value: unknown, options: T): T[number] | null {
  const text = cellText(value)
  if (!text) return null
  return options.find((option) => option.toLowerCase() === text.toLowerCase()) ?? null
}

function canonicalProgress(value: unknown) {
  const text = cellText(value)
  const aliases: Record<string, (typeof IDESIGN_PROGRESS_OPTIONS)[number]> = {
    'clinical review approved': 'Clin. Review Approved',
    'clin review approved': 'Clin. Review Approved',
    'awaiting clinical review': 'Awaiting Clin. Review',
  }
  return aliases[text.toLowerCase()] ?? canonicalValue(text, IDESIGN_PROGRESS_OPTIONS) ?? text
}

function canonicalPaymentStatus(value: unknown) {
  const text = cellText(value)
  if (['invoice not issued', 'invoice not issue'].includes(text.toLowerCase())) return 'Invoice not issue'
  return canonicalValue(text, IDESIGN_PAYMENT_STATUSES) ?? text
}

function parseDateCell(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000)
    return date.toISOString().slice(0, 10)
  }
  const text = cellText(value)
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  const yearFirstWithTime = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:[ T].*)?$/.exec(text)
  if (yearFirstWithTime) return validDate(Number(yearFirstWithTime[1]), Number(yearFirstWithTime[2]), Number(yearFirstWithTime[3]))
  const dayFirst = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text)
  if (dayFirst) return validDate(Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]))
  return text
}

function validDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return 'invalid-date'
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function comparableValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  return String(value).trim()
}

function comparableFieldValue(field: ImportField, value: unknown) {
  return comparableValue(value)
}

function isIncomingOlder(incoming: string | null | undefined, existing: string | null | undefined) {
  return Boolean(incoming && existing && incoming < existing)
}
