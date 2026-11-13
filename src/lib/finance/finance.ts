import { inArray, or, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { idesignOrders } from '@/lib/db/schema'
import { isAdminRole, isPortalRole, isSalesRole } from '@/lib/admin/roles'
import { computeFinanceTotal, FINANCE_CATEGORIES, FINANCE_CURRENCIES, FINANCE_PAYMENT_STATUSES, parseFinanceAmount } from './calc'

export * from './calc'
export const FINANCE_OVERDUE_DAYS_KEY = 'finance_overdue_days'
export const DEFAULT_FINANCE_OVERDUE_DAYS = 30

export function canViewFinance(role: string) {
  return isAdminRole(role) || isSalesRole(role) || isPortalRole(role)
}

export function canManageFinance(role: string) {
  return isAdminRole(role)
}

export function parseOverdueDays(value: string | null | undefined) {
  if (value === null || value === undefined || value.trim() === '') return DEFAULT_FINANCE_OVERDUE_DAYS
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 3650 ? parsed : DEFAULT_FINANCE_OVERDUE_DAYS
}

export interface FinanceScopeInput {
  role: string
  /** Doctor account whose rows a doctor or clinic staff user sees. */
  ownerId?: number | null
  /** Sales accounts in scope (the user plus, for a director, their assigned reps). */
  salesIds?: number[]
  /** Doctors assigned to those sales accounts. */
  doctorIds?: number[]
}

export function buildFinanceScope({ role, ownerId, salesIds = [], doctorIds = [] }: FinanceScopeInput): SQL | undefined {
  if (isAdminRole(role)) return undefined
  if (isPortalRole(role)) {
    return ownerId && Number.isSafeInteger(ownerId) && ownerId > 0 ? inArray(idesignOrders.doctorAccountId, [ownerId]) : sql`false`
  }
  if (isSalesRole(role)) {
    const validDoctors = doctorIds.filter((id) => Number.isSafeInteger(id) && id > 0)
    const validSales = salesIds.filter((id) => Number.isSafeInteger(id) && id > 0)
    const parts: SQL[] = []
    if (validDoctors.length) parts.push(inArray(idesignOrders.doctorAccountId, validDoctors))
    if (validSales.length) parts.push(inArray(idesignOrders.salesAccountId, validSales))
    if (parts.length === 0) return sql`false`
    return parts.length === 1 ? parts[0] : or(...parts)!
  }
  return sql`false`
}

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((value) => value || null)
const optionalDate = z.string().trim().optional().nullable().transform((value, context) => {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Use a valid date' })
    return z.NEVER
  }
  return value
})
const optionalAmount = z.union([z.string(), z.number()]).optional().nullable().transform((value, context) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = parseFinanceAmount(value)
  if (parsed === null || parsed < 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid amount' })
    return z.NEVER
  }
  return String(parsed)
})
const optionalDiscount = z.union([z.string(), z.number()]).optional().nullable().transform((value, context) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = parseFinanceAmount(value)
  if (parsed === null || parsed < 0 || parsed > 100) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Discount must be between 0 and 100%' })
    return z.NEVER
  }
  return `${Number(parsed.toFixed(4))}%`
})
const optionalUrl = z.string().trim().max(2000).optional().nullable().transform((value, context) => {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('protocol')
    return url.toString()
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Use a full http(s) link' })
    return z.NEVER
  }
})

export const financeRowSchema = z.object({
  patientName: z.string().trim().min(1, 'Patient name is required').max(200),
  orderNo: optionalText(100),
  category: z.enum(FINANCE_CATEGORIES),
  purchasedProducts: optionalText(500),
  originalCurrency: z.enum(FINANCE_CURRENCIES).optional().nullable().transform((value) => value ?? null),
  originalPrice: optionalAmount,
  discount: optionalDiscount,
  paymentStatus: z.enum(FINANCE_PAYMENT_STATUSES),
  invoiceNo: optionalText(100),
  invoiceDate: optionalDate,
  dueDate: optionalDate,
  paymentDate: optionalDate,
  invoiceFileUrl: optionalUrl,
  invoiceFileName: optionalText(300),
  paymentLink: optionalUrl,
  doctorAccountId: z.coerce.number().int().positive().optional().nullable().transform((value) => value ?? null),
})

export type FinanceRowInput = z.infer<typeof financeRowSchema>

/** Applies the server-owned fields: the Total Amount is always derived, never accepted from the client. */
export function financeRowValues(input: FinanceRowInput) {
  const total = computeFinanceTotal(input.originalPrice, input.discount)
  return {
    patientName: input.patientName,
    orderNo: input.orderNo,
    category: input.category,
    purchasedProducts: input.purchasedProducts,
    originalCurrency: input.originalCurrency,
    originalPrice: input.originalPrice,
    discount: input.discount,
    totalAmount: total === null ? null : String(total),
    paymentStatus: input.paymentStatus,
    invoiceNo: input.invoiceNo,
    invoiceDate: input.invoiceDate,
    dueDate: input.dueDate,
    paymentDate: input.paymentDate,
    invoiceFileUrl: input.invoiceFileUrl,
    invoiceFileName: input.invoiceFileUrl ? input.invoiceFileName : null,
    paymentLink: input.paymentLink,
  }
}

export function isAllowedInvoiceUrl(value: string | null) {
  if (!value) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.endsWith('.blob.vercel-storage.com') && url.pathname.startsWith('/finance-invoices/')
  } catch {
    return false
  }
}
