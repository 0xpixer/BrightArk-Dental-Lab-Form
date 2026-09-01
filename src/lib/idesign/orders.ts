import { z } from 'zod'

export const IDESIGN_COUNTRIES = ['Indonesia', 'Singapore', 'Thailand'] as const
export const IDESIGN_CATEGORIES = ['iAlign', 'iScan', 'Dental Lab', 'Others'] as const
export const IDESIGN_PROGRESS_OPTIONS = [
  'Entering Info',
  'Lab Designing',
  'Awaiting Clin. Review',
  'Clin. Review Approved',
  'In Production',
  'Produced',
  'Shipped',
  'Delivered',
  'Completed',
] as const
export const IDESIGN_PAYMENT_STATUSES = ['Invoice not issue', 'Unpaid', 'Paid', 'Free'] as const
export const IDESIGN_CURRENCIES = ['IDR', 'SGD', 'THB'] as const
export const IDESIGN_SALES_COUNTRY: Record<string, (typeof IDESIGN_COUNTRIES)[number]> = {
  'Anisa Arifarahma': 'Indonesia',
  Ade: 'Indonesia',
  'Sendy Surya': 'Indonesia',
  'Germain Ho': 'Singapore',
  'Jian Lu': 'Thailand',
}

export const IDESIGN_PROGRESS_STYLES: Record<string, string> = {
  'Entering Info': 'border-yellow-200 bg-yellow-100 text-yellow-800',
  'Lab Designing': 'border-cyan-200 bg-cyan-100 text-cyan-800',
  'Awaiting Clin. Review': 'border-pink-200 bg-pink-100 text-pink-800',
  'Clin. Review Approved': 'border-indigo-200 bg-indigo-100 text-indigo-800',
  'In Production': 'border-blue-200 bg-blue-100 text-blue-800',
  Produced: 'border-sky-200 bg-sky-100 text-sky-800',
  Shipped: 'border-violet-200 bg-violet-100 text-violet-800',
  Delivered: 'border-teal-200 bg-teal-100 text-teal-800',
  Completed: 'border-green-200 bg-green-100 text-green-800',
}

export const IDESIGN_PROGRESS_COLORS: Record<string, string> = {
  'Entering Info': '#eab308',
  'Lab Designing': '#06b6d4',
  'Awaiting Clin. Review': '#ec4899',
  'Clin. Review Approved': '#6366f1',
  'In Production': '#3b82f6',
  Produced: '#0ea5e9',
  Shipped: '#8b5cf6',
  Delivered: '#14b8a6',
  Completed: '#22c55e',
}

const optionalText = z.string().trim().max(500).optional().nullable().transform((value) => value || null)
const optionalDate = z.string().trim().optional().nullable().transform((value, context) => {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Use a valid date' })
    return z.NEVER
  }
  return value
})

export const createIDesignOrderSchema = z.object({
  salespersonName: z.string().trim().min(1, 'Salesperson is required').max(200),
  country: z.enum(IDESIGN_COUNTRIES),
  patientName: z.string().trim().min(1, 'Patient name is required').max(200),
  caseId: optionalText,
  sourceUpdatedOn: optionalDate,
  sourceCreatedOn: optionalDate,
  doctorName: z.string().trim().min(1, 'Doctor is required').max(200),
  latestProgress: z.enum(IDESIGN_PROGRESS_OPTIONS),
  category: z.enum(IDESIGN_CATEGORIES),
  purchasedProducts: optionalText,
  originalCurrency: z.enum(IDESIGN_CURRENCIES).optional().nullable(),
  originalPrice: optionalText,
  discount: optionalText,
  totalAmount: optionalText,
  paymentCurrency: z.enum(IDESIGN_CURRENCIES).optional().nullable(),
  actualPayment: optionalText,
  paymentStatus: z.enum(IDESIGN_PAYMENT_STATUSES),
  invoiceNo: optionalText,
  invoiceDate: optionalDate,
  paymentDate: optionalDate,
  shippedDate: optionalDate,
  trackingNo: optionalText,
  deliveredDate: optionalDate,
  totalSteps: optionalText,
  producedSteps: optionalText,
  salesCommissionRate: optionalText,
  attributedMonth: optionalText,
  salesCommission: optionalText,
})

export type CreateIDesignOrderInput = z.infer<typeof createIDesignOrderSchema>

export function applyIDesignOrderLogic(input: CreateIDesignOrderInput, today = new Date().toISOString().slice(0, 10)) {
  const originalPrice = parseAmount(input.originalPrice)
  const discount = parsePercent(input.discount)
  const actualPayment = parseAmount(input.actualPayment)
  const commissionRate = parsePercent(input.salesCommissionRate)

  return {
    ...input,
    country: IDESIGN_SALES_COUNTRY[input.salespersonName] ?? input.country,
    sourceCreatedOn: input.sourceCreatedOn ?? today,
    sourceUpdatedOn: input.sourceUpdatedOn ?? today,
    totalAmount: input.totalAmount ?? (originalPrice !== null && discount !== null ? formatCalculatedAmount(originalPrice * (1 - discount)) : null),
    attributedMonth: input.attributedMonth ?? (input.paymentDate
      ? new Date(`${input.paymentDate}T00:00:00Z`).toLocaleDateString('en', { month: 'long', timeZone: 'UTC' })
      : null),
    salesCommission: input.salesCommission ?? (actualPayment !== null && commissionRate !== null
      ? formatCalculatedAmount(actualPayment * commissionRate)
      : null),
  }
}

function parseAmount(value: string | null | undefined) {
  if (!value) return null
  const parsed = Number(value.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function parsePercent(value: string | null | undefined) {
  if (!value) return null
  const parsed = Number(value.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(parsed) ? parsed / 100 : null
}

function formatCalculatedAmount(value: number) {
  return String(Math.round((value + Number.EPSILON) * 100) / 100)
}
