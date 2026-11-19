import { IDESIGN_CATEGORIES, IDESIGN_CURRENCIES, IDESIGN_PAYMENT_STATUSES } from '@/lib/idesign/orders'

// Client-safe finance maths (no database imports), shared by the API and the Finance table.
export const FINANCE_CATEGORIES = IDESIGN_CATEGORIES
export const FINANCE_PAYMENT_STATUSES = IDESIGN_PAYMENT_STATUSES
export const FINANCE_CURRENCIES = IDESIGN_CURRENCIES
export const DENTAL_LAB_CATEGORY = 'Dental Lab'
export const FINANCE_TABS = ['aligners', 'dental'] as const
export type FinanceTab = (typeof FINANCE_TABS)[number]

/** "Clear Aligners" holds every category except Dental Lab. */
export function financeTabCategories(tab: FinanceTab): string[] {
  return tab === 'dental' ? [DENTAL_LAB_CATEGORY] : FINANCE_CATEGORIES.filter((category) => category !== DENTAL_LAB_CATEGORY)
}

export function parseFinanceTab(value: string | null | undefined): FinanceTab {
  return value === 'dental' ? 'dental' : 'aligners'
}

/** Where a Finance row's "Open order" link goes, for the admin dashboard or the doctor portal. */
export function financeOrderHref(row: { caseId: number | null; dentalOrderId: number | null }, area: 'admin' | 'portal') {
  if (row.dentalOrderId) return area === 'admin' ? `/admin/submissions/${row.dentalOrderId}` : `/portal/orders/${row.dentalOrderId}`
  if (row.caseId) return `/${area}/idesign/orders/${row.caseId}`
  return null
}

/** Parses "1,250.50", "IDR 1.000" style amounts. Returns null when nothing numeric is present. */
export function parseFinanceAmount(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const cleaned = value.replace(/[^0-9.-]/g, '')
  if (!cleaned || cleaned === '-' || cleaned === '.') return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

/** Discounts are stored as percentages ("10%" or "10"). Returns the fraction (0.1). */
export function parseDiscountFraction(value: string | number | null | undefined) {
  const parsed = parseFinanceAmount(value)
  return parsed === null ? null : parsed / 100
}

export function formatDiscount(value: string | number | null | undefined) {
  const fraction = parseDiscountFraction(value)
  return fraction === null ? null : `${Number((fraction * 100).toFixed(4))}%`
}

/** Total = Original Price × (1 − Discount). A missing discount counts as 0%. */
export function computeFinanceTotal(originalPrice: string | number | null | undefined, discount: string | number | null | undefined) {
  const price = parseFinanceAmount(originalPrice)
  if (price === null) return null
  const fraction = parseDiscountFraction(discount) ?? 0
  return Math.round((price * (1 - fraction) + Number.EPSILON) * 100) / 100
}

/** Rows without an Original Price (some legacy imports) fall back to their imported Total Amount. */
export function displayFinanceTotal(row: { originalPrice: string | null; discount: string | null; totalAmount: string | null }) {
  return computeFinanceTotal(row.originalPrice, row.discount) ?? parseFinanceAmount(row.totalAmount)
}

export function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** A row-level Due Date wins; otherwise the Invoice Date plus the admin's overdue days. */
export function resolveFinanceDueDate(row: { dueDate: string | null; invoiceDate: string | null }, overdueDays: number) {
  if (row.dueDate) return row.dueDate
  if (row.invoiceDate) return addDays(row.invoiceDate, overdueDays)
  return null
}

/** Only invoiced, unpaid rows can be overdue; Paid, Free and not-yet-invoiced rows never are. */
export function isFinanceOverdue(
  row: { paymentStatus: string; dueDate: string | null; invoiceDate: string | null },
  overdueDays: number,
  today = new Date().toISOString().slice(0, 10),
) {
  if (row.paymentStatus !== 'Unpaid') return false
  const due = resolveFinanceDueDate(row, overdueDays)
  return Boolean(due && today > due)
}

export interface FinanceMoney { currency: string; amount: number }

export interface FinanceMonthSummary {
  /** YYYY-MM */
  month: string
  total: FinanceMoney[]
  paid: FinanceMoney[]
  unpaid: FinanceMoney[]
  counts: { total: number; paid: number; unpaid: number }
}

function sumMoney(rows: { currency: string | null; amount: number | null }[]): FinanceMoney[] {
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (row.amount === null || !Number.isFinite(row.amount)) continue
    const currency = row.currency || '—'
    totals.set(currency, Math.round(((totals.get(currency) ?? 0) + row.amount) * 100) / 100)
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => b.amount - a.amount)
}

/**
 * This month's money. "Due" is everything invoiced in the month (Paid or Unpaid); "Unpaid" is the part of it
 * still open. "Paid" is money received in the month, by payment date, whichever month it was invoiced in.
 * Free and not-yet-invoiced rows owe nothing, so they are left out. Amounts are summed per currency.
 */
export function buildFinanceMonthSummary(
  rows: { paymentStatus: string; invoiceDate: string | null; paymentDate: string | null; originalPrice: string | null; discount: string | null; totalAmount: string | null; currency: string | null }[],
  month: string,
): FinanceMonthSummary {
  const billed = rows.filter((row) => row.invoiceDate?.startsWith(month) && (row.paymentStatus === 'Paid' || row.paymentStatus === 'Unpaid'))
  const money = (list: typeof rows) => sumMoney(list.map((row) => ({ currency: row.currency, amount: displayFinanceTotal(row) })))
  const paid = rows.filter((row) => row.paymentStatus === 'Paid' && row.paymentDate?.startsWith(month))
  const unpaid = billed.filter((row) => row.paymentStatus === 'Unpaid')
  return { month, total: money(billed), paid: money(paid), unpaid: money(unpaid), counts: { total: billed.length, paid: paid.length, unpaid: unpaid.length } }
}
