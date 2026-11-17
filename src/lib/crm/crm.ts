import { z } from 'zod'

// Client-safe CRM rules (no database imports), shared by the API and the CRM table.

export const CRM_ROLES = ['superadmin', 'sales_director', 'sales'] as const
export const CRM_STATUSES = ['lead', 'contacted', 'trial', 'active', 'inactive'] as const
export const CRM_STATUS_LABELS: Record<CrmStatus, string> = {
  lead: 'Lead', contacted: 'Contacted', trial: 'Trial', active: 'Active', inactive: 'Inactive',
}
export const CRM_STATUS_STYLES: Record<CrmStatus, string> = {
  lead: 'border-sky-200 bg-sky-100 text-sky-800',
  contacted: 'border-violet-200 bg-violet-100 text-violet-800',
  trial: 'border-amber-200 bg-amber-100 text-amber-800',
  active: 'border-green-200 bg-green-100 text-green-800',
  inactive: 'border-neutral-200 bg-neutral-100 text-neutral-500',
}
export const CRM_SOURCES = ['registered', 'sales'] as const
export const CRM_ACTIVITY_KINDS = ['note', 'call', 'email', 'meeting', 'visit'] as const
export const CRM_FOLLOW_UP_FILTERS = ['due', 'overdue', 'week', 'none'] as const

export type CrmStatus = (typeof CRM_STATUSES)[number]
export type CrmSource = (typeof CRM_SOURCES)[number]
export type CrmActivityKind = (typeof CRM_ACTIVITY_KINDS)[number]

/** Only Superadmin, Sales Directors and Sales see the CRM. Lab Admin does not. */
export function canViewCrm(role: string) {
  return (CRM_ROLES as readonly string[]).includes(role)
}

export interface CrmAccess {
  userId: number
  role: string
  /** Superadmin sees every record. */
  all: boolean
  /** Sales accounts whose records are in scope: the user plus, for a director, their reps. */
  salesIds: number[]
}

/** Builds the viewer's scope from their role and their getSalesScopeIds() result. */
export function buildCrmAccess(userId: number, role: string, salesScopeIds: number[]): CrmAccess | null {
  if (!canViewCrm(role)) return null
  if (role === 'superadmin') return { userId, role, all: true, salesIds: [] }
  // A plain Sales account never inherits other reps, whatever the assignment table says.
  const salesIds = role === 'sales_director' ? [...new Set([userId, ...salesScopeIds])] : [userId]
  return { userId, role, all: false, salesIds: salesIds.filter((id) => Number.isSafeInteger(id) && id > 0) }
}

export function canAccessCrmOwner(access: CrmAccess, salesId: number) {
  return access.all || access.salesIds.includes(salesId)
}

/** Directors and Superadmin can pick or change a record's sales rep; a Sales rep owns its own records. */
export function canChooseCrmOwner(access: CrmAccess) {
  return access.all || access.role === 'sales_director'
}

export const CRM_TEXT_FIELDS = ['fullName', 'email', 'phone', 'clinicName', 'country', 'city', 'address', 'specialty', 'notes'] as const
export const CRM_FIELDS = [...CRM_TEXT_FIELDS, 'status', 'nextFollowUp', 'tags', 'salesId'] as const
export type CrmField = (typeof CRM_FIELDS)[number]

/** Account-owned fields: shown from the doctor's account and locked in the CRM. */
export const CRM_MIRRORED_FIELDS = ['fullName', 'email', 'clinicName', 'address'] as const
/** Safe contact fields: editing them in the CRM also updates the doctor's account. */
export const CRM_WRITE_THROUGH_FIELDS = ['phone', 'country', 'city'] as const

export interface CrmFieldAccess {
  /** Fields that cannot be edited on this record. */
  locked: CrmField[]
  /** Fields whose edits are also written to the linked doctor account. */
  writeThrough: CrmField[]
}

/**
 * Sync policy for a record.
 * - Linked to an account the owner is currently assigned to: name, email, clinic and address are
 *   read-only mirrors of the account (the doctor's profile owns them); phone, country and city are
 *   two-way (saved to both); CRM fields (status, follow-up, notes, tags, specialty) are CRM-only.
 *   The sales rep is locked too: it follows the assignment managed in Accounts.
 * - Linked but not (or no longer) assigned: the CRM keeps its own copy; only the email is locked
 *   because it is the link key.
 * - Not linked: every field is the CRM's own and editable.
 */
export function crmFieldAccess(row: { doctorAccountId: number | null; assigned: boolean }): CrmFieldAccess {
  if (!row.doctorAccountId) return { locked: [], writeThrough: [] }
  if (!row.assigned) return { locked: ['email'], writeThrough: [] }
  // The owner of an assigned doctor changes through the sales↔doctor assignment (Accounts).
  return { locked: [...CRM_MIRRORED_FIELDS, 'salesId'], writeThrough: [...CRM_WRITE_THROUGH_FIELDS] }
}

export function normalizeCrmEmail(value: string | null | undefined) {
  const email = (value ?? '').trim().toLowerCase()
  return email || null
}

const optionalText = (max: number) => z.union([z.string(), z.null()]).optional()
  .transform((value) => (typeof value === 'string' ? value.trim() : value) || null)
  .refine((value) => value === null || value.length <= max, `Must be ${max} characters or fewer`)

const optionalEmail = z.union([z.string(), z.null()]).optional().transform((value, context) => {
  const email = normalizeCrmEmail(value)
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid email' })
    return z.NEVER
  }
  return email
})

const optionalDate = z.union([z.string(), z.null()]).optional().transform((value, context) => {
  const text = (value ?? '').trim()
  if (!text) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Use a valid date' })
    return z.NEVER
  }
  return text
})

const tags = z.union([z.array(z.string()), z.string(), z.null()]).optional().transform((value) => {
  const list = Array.isArray(value) ? value : (value ?? '').split(',')
  return [...new Set(list.map((tag) => tag.trim()).filter(Boolean).map((tag) => tag.slice(0, 40)))].slice(0, 20)
})

export const crmFieldSchemas = {
  fullName: z.string().trim().min(1, 'Name is required').max(200),
  email: optionalEmail,
  phone: optionalText(60),
  clinicName: optionalText(200),
  country: optionalText(100),
  city: optionalText(120),
  address: optionalText(500),
  specialty: optionalText(120),
  notes: optionalText(5000),
  status: z.enum(CRM_STATUSES),
  nextFollowUp: optionalDate,
  tags,
  salesId: z.coerce.number().int().positive(),
} satisfies Record<CrmField, z.ZodTypeAny>

export const crmCreateSchema = z.object({
  ...crmFieldSchemas,
  status: crmFieldSchemas.status.default('lead'),
  salesId: crmFieldSchemas.salesId.optional(),
})

export const crmPatchSchema = z.object(crmFieldSchemas).partial().strict()
export type CrmPatch = z.infer<typeof crmPatchSchema>

export const crmActivitySchema = z.object({
  kind: z.enum(CRM_ACTIVITY_KINDS).default('note'),
  body: z.string().trim().min(1, 'Write something first').max(5000),
})

/** Fields a patch tries to change that this record does not allow. */
export function lockedFieldsInPatch(patch: Record<string, unknown>, access: CrmFieldAccess) {
  return Object.keys(patch).filter((field) => access.locked.includes(field as CrmField))
}

export interface MoneyTotal { currency: string; amount: number }

/** Sums amounts per currency, largest first. Rows without an amount are skipped. */
export function sumByCurrency(rows: { currency: string | null; amount: number | null }[]): MoneyTotal[] {
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (row.amount === null || !Number.isFinite(row.amount)) continue
    const currency = row.currency || '—'
    totals.set(currency, Math.round(((totals.get(currency) ?? 0) + row.amount) * 100) / 100)
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount })).sort((a, b) => b.amount - a.amount)
}

export function followUpState(date: string | null, today: string) {
  if (!date) return 'none' as const
  if (date < today) return 'overdue' as const
  if (date === today) return 'today' as const
  return 'upcoming' as const
}
