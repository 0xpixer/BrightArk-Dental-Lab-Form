import type { CrmField, MoneyTotal } from '@/lib/crm/crm'

export interface CrmStats { activeCases: number; lastOrderDate: string | null; unpaid: MoneyTotal[] }

export interface CrmRow {
  id: number
  salesId: number
  ownerName: string
  doctorAccountId: number | null
  accountActive: boolean | null
  assigned: boolean
  fullName: string
  email: string | null
  phone: string | null
  clinicName: string | null
  country: string | null
  city: string | null
  address: string | null
  specialty: string | null
  status: string
  source: string
  nextFollowUp: string | null
  notes: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
  fieldAccess: { locked: CrmField[]; writeThrough: CrmField[] }
  stats: CrmStats | null
}

export interface CrmOwnerOption { id: number; name: string }

export interface CrmOptions { statuses: string[]; countries: string[]; owners: CrmOwnerOption[] }

export interface CrmViewer { userId: number; role: string; canChooseOwner: boolean }

export type CrmValue = string | string[] | number | null

export type CrmFieldKind = 'text' | 'email' | 'tel' | 'country' | 'city' | 'status' | 'date' | 'tags' | 'textarea' | 'owner'

export interface CrmFieldDef { key: CrmField; label: string; kind: CrmFieldKind; width: string; placeholder?: string }

export const CRM_FIELD_DEFS: CrmFieldDef[] = [
  { key: 'fullName', label: 'Doctor', kind: 'text', width: 'w-48', placeholder: 'Doctor name' },
  { key: 'status', label: 'Status', kind: 'status', width: 'w-32' },
  { key: 'nextFollowUp', label: 'Next follow-up', kind: 'date', width: 'w-36' },
  { key: 'email', label: 'Email', kind: 'email', width: 'w-56', placeholder: 'name@clinic.com' },
  { key: 'phone', label: 'Phone', kind: 'tel', width: 'w-36', placeholder: '+62…' },
  { key: 'clinicName', label: 'Clinic', kind: 'text', width: 'w-44', placeholder: 'Clinic name' },
  { key: 'country', label: 'Country', kind: 'country', width: 'w-36' },
  { key: 'city', label: 'City', kind: 'city', width: 'w-32', placeholder: 'City' },
  { key: 'address', label: 'Address', kind: 'textarea', width: 'w-56', placeholder: 'Street, building…' },
  { key: 'specialty', label: 'Specialty', kind: 'text', width: 'w-36', placeholder: 'Orthodontist…' },
  { key: 'tags', label: 'Tags', kind: 'tags', width: 'w-44', placeholder: 'vip, aligner' },
  { key: 'notes', label: 'Notes', kind: 'textarea', width: 'w-64', placeholder: 'Notes' },
]

/** Columns shown before the read-only Orders column in the table. */
export const CRM_LEAD_FIELDS = new Set(['fullName', 'status', 'nextFollowUp', 'salesId'])

export const CRM_OWNER_FIELD: CrmFieldDef = { key: 'salesId', label: 'Sales rep', kind: 'owner', width: 'w-40' }

export const CRM_INPUT_CLASS = 'h-8 w-full min-w-0 rounded-card border border-border bg-surface px-2 text-xs text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10'
export const CRM_FIELD_INPUT_CLASS = 'h-11 w-full min-w-0 rounded-card border border-border bg-surface px-3 text-base text-text md:text-sm outline-none focus:border-text focus:ring-2 focus:ring-text/10 md:h-10'

export function localToday() {
  return new Date().toLocaleDateString('en-CA')
}

export function formatCrmDate(value: string | null) {
  if (!value) return ''
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatMoney(total: MoneyTotal) {
  return `${total.currency} ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(total.amount)}`
}

export function lockReason(row: CrmRow, field: CrmField) {
  if (!row.fieldAccess.locked.includes(field)) return null
  if (field === 'salesId') return 'Follows the doctor’s sales assignment (Accounts)'
  if (field === 'email' && !row.assigned) return 'Linked to the doctor’s account by this email'
  return 'Managed by the doctor’s own account'
}
