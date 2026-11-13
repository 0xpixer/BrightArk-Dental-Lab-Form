import { IDESIGN_CATEGORIES, IDESIGN_CURRENCIES, IDESIGN_PAYMENT_STATUSES } from '@/lib/idesign/orders'

// Client-safe finance maths (no database imports), shared by the API and the Finance table.
export const FINANCE_CATEGORIES = IDESIGN_CATEGORIES
export const FINANCE_PAYMENT_STATUSES = IDESIGN_PAYMENT_STATUSES
export const FINANCE_CURRENCIES = IDESIGN_CURRENCIES

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
