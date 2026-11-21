'use client'

import { useCallback, useContext, useEffect, useState } from 'react'
import { Mail, MailOpen, MessageSquarePlus, Phone, PhoneCall, Plus, CirclePlus, Send, Trash2, X } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { CityInput, CountrySelect } from '@/components/ui/LocationInputs'
import { CRM_ACTIVITY_KINDS, CRM_STATUS_LABELS, crmNeedsContract } from '@/lib/crm/crm'
import { AvatarPicker, DoctorAvatar } from './DoctorAvatar'
import { ContractControl } from './ContractControl'
import { AccountTypeSelect, CrmApiBase, SpecialtySelect, EditableValue, EmailHints, OrdersSummary, SourceBadge, useEmailCheck } from './CrmCells'
import {
  CRM_FIELD_DEFS, CRM_FIELD_INPUT_CLASS, CRM_OWNER_FIELD, lockReason,
  type CrmOptions, type CrmRow, type CrmValue, type CrmViewer,
} from './crmTypes'

interface Activity { id: number; kind: string; body: string; createdAt: string; authorName: string | null }

const ACTIVITY_LABELS: Record<string, string> = { note: 'Note', call: 'Call', email: 'Email', meeting: 'Meeting', visit: 'Visit' }

const PANEL_CLASS = {
  // Phones: bottom sheet for both. Desktop: the record opens as a right drawer, Add doctor as a centred dialog.
  drawer: 'md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[520px] md:rounded-none',
  dialog: 'md:inset-auto md:left-1/2 md:top-1/2 md:max-h-[88vh] md:w-[640px] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-card',
}

function Sheet({ title, onClose, children, variant = 'drawer' }: { title: string; onClose: () => void; children: React.ReactNode; variant?: keyof typeof PANEL_CLASS }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !(event.target as HTMLElement)?.closest('input, select, textarea')) onClose() }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className={`absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-2xl bg-surface pb-[env(safe-area-inset-bottom)] shadow-xl ${PANEL_CLASS[variant]}`}>
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border md:hidden" aria-hidden />
        {children}
      </div>
    </div>
  )
}

export function CrmEditSheet({ row, viewer, options, onClose, onSave, onContract, onDelete }: {
  row: CrmRow
  viewer: CrmViewer
  options: CrmOptions
  onClose: () => void
  onSave: (field: string, value: CrmValue) => void
  onContract: (contract: { url: string; fileName: string } | null) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const apiBase = useContext(CrmApiBase)
  const [activities, setActivities] = useState<Activity[] | null>(null)
  const [kind, setKind] = useState<string>('call')
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const defs = viewer.canChooseOwner ? [...CRM_FIELD_DEFS, CRM_OWNER_FIELD] : CRM_FIELD_DEFS
  const canDelete = !(row.doctorAccountId && row.assigned)

  const loadActivities = useCallback(async () => {
    const response = await fetch(`${apiBase}/${row.id}/activities`)
    const payload = await response.json().catch(() => ({}))
    if (response.ok) setActivities(payload.activities)
  }, [apiBase, row.id])
  useEffect(() => { void loadActivities() }, [loadActivities])

  async function addActivity(event: React.FormEvent) {
    event.preventDefault()
    if (!body.trim()) return
    setPosting(true)
    setError('')
    try {
      const response = await fetch(`${apiBase}/${row.id}/activities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, body }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Could not add the activity')
      setActivities(payload.activities)
      setBody('')
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : 'Could not add the activity')
    } finally {
      setPosting(false)
    }
  }

  return (
    <Sheet title={row.fullName} onClose={onClose}>
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <DoctorAvatar name={row.fullName} url={row.avatarUrl} />
          <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-text">{row.fullName}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted"><SourceBadge row={row} /><span>Sales rep: {row.ownerName}</span></div>
          </div>
        </div>
        <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-card text-text-muted hover:bg-bg md:h-9 md:w-9" aria-label="Close"><MorphIcon icon={X} className="h-4 w-4" /></button>
      </header>
      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <AvatarPicker name={row.fullName} url={row.avatarUrl} onChange={(url) => { setPhotoError(''); onSave('avatarUrl', url) }} onError={setPhotoError} />
        {photoError && <p role="alert" className="-mt-3 text-xs text-red-700">{photoError}</p>}
        <div className="flex flex-wrap gap-2">
          {row.phone && <a href={`tel:${row.phone.replace(/[^\d+]/g, '')}`} className="inline-flex h-11 items-center gap-2 rounded-card bg-text px-4 text-xs font-semibold text-white hover:bg-neutral-700 md:h-9"><MorphIcon icon={Phone} hoverIcon={PhoneCall} className="h-3.5 w-3.5" />Call</a>}
          {row.email && <a href={`mailto:${row.email}`} className="inline-flex h-11 items-center gap-2 rounded-card bg-text px-4 text-xs font-semibold text-white hover:bg-neutral-700 md:h-9"><MorphIcon icon={Mail} hoverIcon={MailOpen} className="h-3.5 w-3.5" />Email</a>}
        </div>
        <section className="rounded-card border border-border bg-bg/60 p-3"><h3 className="mb-1 text-xs font-semibold uppercase text-text-muted">Orders</h3><OrdersSummary row={row} compact /></section>
        {row.fieldAccess.locked.length > 0 && row.assigned && <p className="text-xs text-text-muted">Name, email, clinic and address come from the doctor’s account. Phone, country and city edits update the account too.</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {defs.map((def) => (
            <div key={def.key} className={`min-w-0 ${def.kind === 'textarea' ? 'sm:col-span-2' : ''}`}>
              <p className="mb-1 text-xs font-medium text-text-muted">{def.label}</p>
              <EditableValue def={def} row={row} owners={options.owners} lock={lockReason(row, def.key, viewer)} writeThrough={row.fieldAccess.writeThrough.includes(def.key)} variant="field" onSave={(value) => onSave(def.key, value)} />
            </div>
          ))}
        </div>

        <ContractControl record={row} variant="block" onError={setPhotoError} onChange={async (contract) => {
          if (!contract && !window.confirm('Remove the contract from this record?')) return
          await onContract(contract)
        }} />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-text">Activity</h3>
          <form onSubmit={addActivity} className="space-y-2 rounded-card border border-border p-3">
            <div className="flex flex-wrap gap-1.5">
              {CRM_ACTIVITY_KINDS.map((value) => <button key={value} type="button" onClick={() => setKind(value)} aria-pressed={kind === value} className={`h-9 rounded-card border px-3 text-xs font-medium ${kind === value ? 'border-text bg-text text-white' : 'border-border text-text-muted hover:bg-bg'}`}>{ACTIVITY_LABELS[value]}</button>)}
            </div>
            <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={5000} placeholder="What happened? Next steps…" aria-label="Activity details" className={`${CRM_FIELD_INPUT_CLASS} h-auto py-2`} />
            {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
            <button type="submit" disabled={posting || !body.trim()} className="inline-flex h-11 items-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40 md:h-9"><MorphIcon icon={MessageSquarePlus} hoverIcon={Send} className="h-4 w-4" />{posting ? 'Saving…' : 'Log activity'}</button>
          </form>
          {activities === null
            ? <p className="text-sm text-text-muted">Loading activity…</p>
            : activities.length === 0
              ? <p className="text-sm text-text-muted">No activity yet</p>
              : <ol className="space-y-2">{activities.map((activity) => (
                <li key={activity.id} className="rounded-card border border-border px-3 py-2">
                  <p className="text-[11px] text-text-muted"><span className="font-semibold text-text">{ACTIVITY_LABELS[activity.kind] ?? activity.kind}</span> · {activity.authorName ?? 'Unknown'} · {new Date(activity.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="mt-1 whitespace-pre-line break-words text-sm text-text">{activity.body}</p>
                </li>
              ))}</ol>}
        </section>

        {canDelete && <button type="button" onClick={() => { if (window.confirm(`Delete ${row.fullName} from the CRM? Its activity log is deleted too.`)) void onDelete() }} className="inline-flex h-11 items-center gap-2 rounded-card border border-red-200 px-4 text-xs font-semibold text-red-700 hover:bg-red-50 md:h-9"><MorphIcon icon={Trash2} className="h-3.5 w-3.5" />Delete record</button>}
      </div>
    </Sheet>
  )
}

interface CreateDraft {
  fullName: string; email: string; phone: string; clinicName: string; country: string; city: string
  address: string; specialty: string; status: string; nextFollowUp: string; notes: string; salesId: string; avatarUrl: string
  accountType: string; contractUrl: string; contractFileName: string
}

export function CrmCreateSheet({ viewer, options, defaultSalesId, onClose, onCreate }: {
  viewer: CrmViewer
  options: CrmOptions
  defaultSalesId: number | null
  onClose: () => void
  onCreate: (values: Record<string, unknown>) => Promise<string | null>
}) {
  const [draft, setDraft] = useState<CreateDraft>({
    fullName: '', email: '', phone: '', clinicName: '', country: '', city: '', address: '', specialty: '',
    status: 'lead', nextFollowUp: '', notes: '', avatarUrl: '', accountType: '', contractUrl: '', contractFileName: '',
    salesId: String(defaultSalesId ?? (viewer.role === 'superadmin' ? '' : viewer.userId)),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const salesId = Number(draft.salesId) || null
  const emailCheck = useEmailCheck(draft.email, salesId, null)
  const blocked = Boolean(emailCheck?.inScope.some((match) => match.sameOwner))
  const set = (field: keyof CreateDraft) => (value: string) => setDraft((current) => ({ ...current, [field]: value }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const { salesId: owner, contractUrl, contractFileName, ...rest } = draft
    // A contract only goes with a tag that needs one (switching to Non-KA drops a pending upload).
    const contract = crmNeedsContract(draft.accountType) && contractUrl ? { contractUrl, contractFileName } : {}
    const failure = await onCreate({ ...rest, ...contract, ...(viewer.canChooseOwner ? { salesId: Number(owner) || undefined } : {}) })
    setSaving(false)
    if (failure) setError(failure)
  }

  const label = 'mb-1 block text-xs font-medium text-text-muted'
  return (
    <Sheet title="Add doctor" onClose={onClose} variant="dialog">
      <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-text">Add doctor</h2>
          <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-card text-text-muted hover:bg-bg md:h-9 md:w-9" aria-label="Close"><MorphIcon icon={X} className="h-4 w-4" /></button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <p className="text-xs text-text-muted">When a doctor registers with this email, the record links to their account automatically — no duplicate is created.</p>
          {viewer.canChooseOwner && <label className="block"><span className={label}>Sales rep *</span>
            <select required value={draft.salesId} onChange={(event) => set('salesId')(event.target.value)} className={CRM_FIELD_INPUT_CLASS}>
              <option value="">Choose a sales rep</option>
              {options.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
            </select></label>}
          <AvatarPicker name={draft.fullName || 'New doctor'} url={draft.avatarUrl || null} onChange={(url) => set('avatarUrl')(url ?? '')} onError={setError} />
          <label className="block"><span className={label}>Doctor name *</span><input required maxLength={200} value={draft.fullName} onChange={(event) => set('fullName')(event.target.value)} className={CRM_FIELD_INPUT_CLASS} placeholder="Dr. Jane Tan" /></label>
          <label className="block"><span className={label}>Email</span><input type="email" maxLength={254} value={draft.email} onChange={(event) => set('email')(event.target.value)} className={CRM_FIELD_INPUT_CLASS} placeholder="name@clinic.com" /></label>
          <EmailHints check={emailCheck} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block"><span className={label}>Phone</span><input type="tel" maxLength={60} value={draft.phone} onChange={(event) => set('phone')(event.target.value)} className={CRM_FIELD_INPUT_CLASS} /></label>
            <label className="block"><span className={label}>Clinic</span><input maxLength={200} value={draft.clinicName} onChange={(event) => set('clinicName')(event.target.value)} className={CRM_FIELD_INPUT_CLASS} /></label>
            <label className="block"><span className={label}>Country</span><CountrySelect value={draft.country} onChange={set('country')} className={CRM_FIELD_INPUT_CLASS} /></label>
            <label className="block"><span className={label}>City</span><CityInput value={draft.city} country={draft.country} onChange={set('city')} listId="crm-new-city" className={CRM_FIELD_INPUT_CLASS} /></label>
          </div>
          <label className="block"><span className={label}>Address</span><input maxLength={500} value={draft.address} onChange={(event) => set('address')(event.target.value)} className={CRM_FIELD_INPUT_CLASS} /></label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block"><span className={label}>Specialty</span><SpecialtySelect value={draft.specialty} onPick={set('specialty')} className={CRM_FIELD_INPUT_CLASS} /></label>
            <label className="block"><span className={label}>Status</span><select value={draft.status} onChange={(event) => set('status')(event.target.value)} className={CRM_FIELD_INPUT_CLASS}>{Object.entries(CRM_STATUS_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>
            <label className="block"><span className={label}>Next follow-up</span><input type="date" value={draft.nextFollowUp} onChange={(event) => set('nextFollowUp')(event.target.value)} className={CRM_FIELD_INPUT_CLASS} /></label>
            <label className="block"><span className={label}>Tag</span><AccountTypeSelect value={draft.accountType} onPick={set('accountType')} className={CRM_FIELD_INPUT_CLASS} /></label>
          </div>
          <ContractControl
            record={{ id: null, fullName: draft.fullName || 'doctor', accountType: draft.accountType || null, hasContract: false, contractFileName: null, contractUploadedAt: null }}
            variant="block"
            pendingFileName={draft.contractUrl ? draft.contractFileName : null}
            onError={setError}
            onChange={(contract) => setDraft((current) => ({ ...current, contractUrl: contract?.url ?? '', contractFileName: contract?.fileName ?? '' }))}
          />
          <label className="block"><span className={label}>Notes</span><textarea rows={3} maxLength={5000} value={draft.notes} onChange={(event) => set('notes')(event.target.value)} className={`${CRM_FIELD_INPUT_CLASS} h-auto py-2`} /></label>
          {error && <p role="alert" className="rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={onClose} className="h-11 rounded-card border border-border px-4 text-sm font-medium text-text hover:bg-bg md:h-10">Cancel</button>
          <button type="submit" disabled={saving || blocked || !draft.fullName.trim() || (viewer.canChooseOwner && !draft.salesId)} className="inline-flex h-11 items-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40 md:h-10"><MorphIcon icon={Plus} hoverIcon={CirclePlus} className="h-4 w-4" />{saving ? 'Adding…' : 'Add doctor'}</button>
        </footer>
      </form>
    </Sheet>
  )
}
