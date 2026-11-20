'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Lock, LockKeyhole, RefreshCw, RefreshCcw } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { CityInput, CountrySelect } from '@/components/ui/LocationInputs'
import { CRM_ACCOUNT_TYPE_STYLES, CRM_ACCOUNT_TYPES, CRM_SPECIALTIES, CRM_STATUS_LABELS, CRM_STATUS_STYLES, followUpState, type CrmAccountType, type CrmStatus } from '@/lib/crm/crm'
import {
  CRM_FIELD_INPUT_CLASS, CRM_INPUT_CLASS, formatCrmDate, formatMoney, localToday,
  type CrmFieldDef, type CrmOwnerOption, type CrmRow, type CrmStats, type CrmValue,
} from './crmTypes'

/** Base URL of the CRM API (overridable for previews). */
export const CrmApiBase = createContext('/api/crm/doctors')

export function StatusBadge({ status }: { status: string }) {
  const style = CRM_STATUS_STYLES[status as CrmStatus] ?? 'border-border bg-bg text-text-muted'
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${style}`}>{CRM_STATUS_LABELS[status as CrmStatus] ?? status}</span>
}

export function AccountTypeBadge({ type }: { type: string }) {
  const style = CRM_ACCOUNT_TYPE_STYLES[type as CrmAccountType] ?? 'border-border bg-bg text-text-muted'
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${style}`}>{type}</span>
}

/** Fixed-list select that still shows a legacy free-text value already stored on the record. */
function ChoiceSelect({ value, options, onPick, className, label, autoFocus, onKeyDown, onBlur }: {
  value: string; options: readonly string[]; onPick: (value: string) => void; className: string; label: string
  autoFocus?: boolean; onKeyDown?: React.KeyboardEventHandler<HTMLSelectElement>; onBlur?: () => void
}) {
  return (
    <select autoFocus={autoFocus} aria-label={label} value={value} onChange={(event) => onPick(event.target.value)} onKeyDown={onKeyDown} onBlur={onBlur} className={className}>
      <option value="">—</option>
      {value && !options.includes(value) && <option value={value}>{value}</option>}
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  )
}

export function AccountTypeSelect(props: { value: string; onPick: (value: string) => void; className: string }) {
  return <ChoiceSelect {...props} options={CRM_ACCOUNT_TYPES} label="Tag" />
}

export function SpecialtySelect(props: { value: string; onPick: (value: string) => void; className: string }) {
  return <ChoiceSelect {...props} options={CRM_SPECIALTIES} label="Specialty" />
}

export function FollowUpBadge({ date }: { date: string | null }) {
  const state = followUpState(date, localToday())
  if (state === 'none') return <span className="text-text-muted">—</span>
  const style = state === 'overdue' ? 'text-red-700 font-semibold' : state === 'today' ? 'text-primary font-semibold' : 'text-text'
  return <span className={`whitespace-nowrap ${style}`}>{formatCrmDate(date)}{state === 'overdue' ? ' · overdue' : state === 'today' ? ' · today' : ''}</span>
}

export function TagChips({ tags }: { tags: string[] }) {
  if (!tags.length) return <span className="text-text-muted">—</span>
  return <span className="flex flex-wrap gap-1">{tags.map((tag) => <span key={tag} className="rounded bg-bg px-1.5 py-0.5 text-[11px] font-medium text-text">{tag}</span>)}</span>
}

export function OrdersSummary({ row, compact = false }: { row: CrmRow; compact?: boolean }) {
  if (!row.doctorAccountId) return <span className="text-xs text-text-muted">No account yet</span>
  if (!row.stats) return <span className="text-xs text-text-muted">Not assigned to this rep</span>
  const stats: CrmStats = row.stats
  return (
    <div className={`text-xs ${compact ? 'flex flex-wrap gap-x-3 gap-y-0.5' : 'space-y-0.5'}`}>
      <p className="whitespace-nowrap text-text"><span className="font-semibold">{stats.activeCases}</span> active {stats.activeCases === 1 ? 'case' : 'cases'}</p>
      <p className="whitespace-nowrap text-text-muted">{stats.lastOrderDate ? `Last order ${formatCrmDate(stats.lastOrderDate)}` : 'No orders yet'}</p>
      {stats.unpaid.length > 0 && <p className="whitespace-nowrap font-semibold text-amber-700">Unpaid {stats.unpaid.map(formatMoney).join(' · ')}</p>}
    </div>
  )
}

export function SourceBadge({ row }: { row: CrmRow }) {
  if (row.doctorAccountId) {
    return <span className="inline-flex whitespace-nowrap rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-800" title={row.source === 'sales' ? 'Added by sales, then linked to the doctor’s account by email' : 'Registered doctor assigned to this rep'}>{row.source === 'sales' ? 'Linked account' : 'Registered'}</span>
  }
  return <span className="inline-flex whitespace-nowrap rounded-full border border-border bg-bg px-2 py-0.5 text-[11px] font-medium text-text-muted" title="Added by sales; links automatically when this email registers">Added by sales</span>
}

export interface EmailCheck {
  inScope: { id: number; ownerName: string; fullName: string; sameOwner: boolean }[]
  otherCount: number
  registered: { name: string | null } | null
}

/** Debounced duplicate-email lookup for the CRM. */
export function useEmailCheck(email: string, salesId: number | null, excludeId: number | null, enabled = true) {
  const [result, setResult] = useState<EmailCheck | null>(null)
  const apiBase = useContext(CrmApiBase)
  useEffect(() => {
    const value = email.trim()
    if (!enabled || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) { setResult(null); return }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ email: value })
      if (salesId) params.set('salesId', String(salesId))
      if (excludeId) params.set('excludeId', String(excludeId))
      fetch(`${apiBase}/check-email?${params}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => setResult(payload))
        .catch(() => undefined)
    }, 350)
    return () => { clearTimeout(timer); controller.abort() }
  }, [apiBase, email, salesId, excludeId, enabled])
  return result
}

export function emailHints(check: EmailCheck | null): { tone: 'error' | 'warn' | 'info'; text: string }[] {
  if (!check) return []
  const hints: { tone: 'error' | 'warn' | 'info'; text: string }[] = []
  const same = check.inScope.find((match) => match.sameOwner)
  if (same) hints.push({ tone: 'error', text: `Already in this rep’s CRM as ${same.fullName}` })
  const others = check.inScope.filter((match) => !match.sameOwner)
  if (others.length) hints.push({ tone: 'warn', text: `Also tracked by ${[...new Set(others.map((match) => match.ownerName))].join(', ')}` })
  if (check.otherCount > 0) hints.push({ tone: 'warn', text: `Also tracked by ${check.otherCount} other sales ${check.otherCount === 1 ? 'rep' : 'reps'}` })
  if (check.registered) hints.push({ tone: 'info', text: `Registered doctor${check.registered.name ? ` (${check.registered.name})` : ''} — links to their account automatically` })
  return hints
}

export function EmailHints({ check }: { check: EmailCheck | null }) {
  const hints = emailHints(check)
  if (!hints.length) return null
  return <div className="space-y-0.5">{hints.map((hint) => <p key={hint.text} role={hint.tone === 'error' ? 'alert' : 'status'} className={`text-[11px] leading-snug ${hint.tone === 'error' ? 'text-red-700' : hint.tone === 'warn' ? 'text-amber-700' : 'text-text-muted'}`}>{hint.text}</p>)}</div>
}

function displayValue(def: CrmFieldDef, row: CrmRow, owners: CrmOwnerOption[]): ReactNode {
  const value = row[def.key as keyof CrmRow]
  switch (def.kind) {
    case 'status': return <StatusBadge status={row.status} />
    case 'date': return row.nextFollowUp ? <FollowUpBadge date={row.nextFollowUp} /> : null
    case 'tags': return row.tags.length ? <TagChips tags={row.tags} /> : null
    case 'accountType': return row.accountType ? <AccountTypeBadge type={row.accountType} /> : null
    case 'owner': return owners.find((owner) => owner.id === row.salesId)?.name ?? row.ownerName
    default: return typeof value === 'string' && value ? value : null
  }
}

function toDraft(def: CrmFieldDef, row: CrmRow) {
  if (def.kind === 'tags') return row.tags.join(', ')
  if (def.kind === 'owner') return String(row.salesId)
  const value = row[def.key as keyof CrmRow]
  return typeof value === 'string' ? value : ''
}

function fromDraft(def: CrmFieldDef, draft: string): CrmValue {
  if (def.kind === 'tags') return [...new Set(draft.split(',').map((tag) => tag.trim()).filter(Boolean))]
  if (def.kind === 'owner') return Number(draft)
  if (def.key === 'fullName') return draft.trim()
  return draft.trim() || null
}

/**
 * Click-to-edit value. Saves on Enter/blur (selects save on change), Esc cancels.
 * The parent applies the change optimistically and rolls back if the API rejects it.
 */
export function EditableValue({ def, row, owners, lock, writeThrough, variant, onSave }: {
  def: CrmFieldDef
  row: CrmRow
  owners: CrmOwnerOption[]
  lock: string | null
  writeThrough: boolean
  variant: 'cell' | 'field'
  onSave: (value: CrmValue) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const committed = useRef(false)
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (editing) container.current?.querySelector<HTMLElement>('input, select, textarea')?.focus()
  }, [editing])
  const emailCheck = useEmailCheck(draft, row.salesId, row.id, editing && def.kind === 'email' && draft.trim().toLowerCase() !== (row.email ?? '').toLowerCase())
  const inputClass = variant === 'cell' ? CRM_INPUT_CLASS : CRM_FIELD_INPUT_CLASS

  function start() {
    if (lock) return
    committed.current = false
    setDraft(toDraft(def, row))
    setEditing(true)
  }
  function commit(next = draft) {
    if (committed.current) return
    committed.current = true
    setEditing(false)
    if (next === toDraft(def, row)) return
    if (def.key === 'fullName' && !next.trim()) return
    onSave(fromDraft(def, next))
  }
  function cancel() {
    committed.current = true
    setEditing(false)
  }
  const keys = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); cancel() }
    if (event.key === 'Enter' && !(def.kind === 'textarea' && event.shiftKey)) { event.preventDefault(); commit() }
  }

  if (editing) {
    const common = { autoFocus: true, 'aria-label': def.label, onKeyDown: keys }
    let input: ReactNode
    if (def.kind === 'status') {
      input = <select {...common} value={draft} onChange={(event) => commit(event.target.value)} onBlur={() => commit()} className={inputClass}>{Object.entries(CRM_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    } else if (def.kind === 'accountType' || def.kind === 'specialty') {
      input = <ChoiceSelect autoFocus value={draft} options={def.kind === 'accountType' ? CRM_ACCOUNT_TYPES : CRM_SPECIALTIES} label={def.label} onPick={(value) => commit(value)} onKeyDown={keys} onBlur={() => commit()} className={inputClass} />
    } else if (def.kind === 'owner') {
      input = <select {...common} value={draft} onChange={(event) => commit(event.target.value)} onBlur={() => commit()} className={inputClass}>{owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}</select>
    } else if (def.kind === 'country') {
      input = <span onKeyDown={keys} onBlur={() => commit()}><CountrySelect value={draft} onChange={(value) => commit(value)} className={inputClass} aria-label={def.label} /></span>
    } else if (def.kind === 'city') {
      input = <span onKeyDown={keys} onBlur={() => commit()}><CityInput value={draft} country={row.country ?? ''} onChange={setDraft} listId={`crm-city-${row.id}`} className={inputClass} aria-label={def.label} /></span>
    } else if (def.kind === 'textarea') {
      input = <textarea {...common} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => commit()} rows={3} placeholder={def.placeholder} className={`${inputClass} h-auto py-1.5`} />
    } else {
      const type = def.kind === 'date' ? 'date' : def.kind === 'email' ? 'email' : def.kind === 'tel' ? 'tel' : 'text'
      input = <input {...common} type={type} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => commit()} placeholder={def.placeholder} className={inputClass} />
    }
    return <div ref={container} className="space-y-1">{input}{def.kind === 'email' && <EmailHints check={emailCheck} />}</div>
  }

  const shown = displayValue(def, row, owners)
  return (
    <button
      type="button"
      onClick={start}
      title={lock ?? (writeThrough ? 'Also updates the doctor’s account' : `Edit ${def.label.toLowerCase()}`)}
      aria-label={lock ? `${def.label}: ${lock}` : `Edit ${def.label}`}
      className={`group flex w-full min-w-0 items-start gap-1 rounded-card text-left text-sm ${variant === 'cell' ? 'min-h-8 px-1.5 py-1' : 'min-h-11 border border-border px-3 py-2.5 md:min-h-10'} ${lock ? 'cursor-default text-text' : 'text-text hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text/10'}`}
    >
      <span className={`min-w-0 flex-1 ${def.kind === 'textarea' ? 'line-clamp-2 whitespace-pre-line break-words' : def.kind === 'tags' ? '' : 'truncate'}`}>{shown ?? <span className="text-text-muted/70 group-hover:text-text-muted">{lock ? '—' : 'Add'}</span>}</span>
      {lock && <span className="mt-0.5 shrink-0 text-text-muted"><MorphIcon icon={Lock} hoverIcon={LockKeyhole} className="h-3 w-3" /></span>}
      {!lock && writeThrough && <span className="mt-0.5 shrink-0 text-text-muted/60" aria-hidden><MorphIcon icon={RefreshCw} hoverIcon={RefreshCcw} className="h-3 w-3" /></span>}
    </button>
  )
}
