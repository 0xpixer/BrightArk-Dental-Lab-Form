'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, BadgeCheck, Check, CircleCheck, Network, Save, Search, TriangleAlert, UserPlus, UserRound, UsersRound, Wrench, X } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { Toast } from './Toast'

interface SalesAccount { id: number; name: string; role: string; isActive: boolean; country: string | null }
interface Director { id: number; name: string; isActive: boolean; salesIds: number[] }
interface Doctor {
  id: number
  name: string
  email: string | null
  clinicName: string | null
  country: string | null
  city: string | null
  isActive: boolean
  createdAt: string
  salesId: number | null
  extraSalesIds: number[]
  salesReferral: string | null
  suggestedSalesId: number | null
  suggestionSource: 'orders' | 'signup' | null
  orderCount: number
  staff: { id: number; name: string }[]
}
type Issue =
  | { kind: 'unassigned_with_orders'; doctorId: number; salesId: number; orderCount: number }
  | { kind: 'orders_missing_sales'; doctorId: number; salesId: number; orderCount: number }
  | { kind: 'orders_other_sales'; doctorId: number; salesId: number; otherSalesIds: number[]; orderCount: number }
interface Data { directors: Director[]; sales: SalesAccount[]; doctors: Doctor[]; issues: Issue[]; canEdit: boolean }
interface MoveRequest { doctor: Doctor; salesId: number | null }

const selectClass = 'h-9 w-full min-w-0 rounded-card border border-border bg-surface px-2.5 text-sm text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10 disabled:opacity-50'
const darkButton = 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-card bg-text px-3 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-40'
const lightButton = 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-card border border-border bg-surface px-3 text-sm font-semibold text-text hover:bg-bg disabled:opacity-40'

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

export function RelationshipsBoard() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<number[]>([])
  const [bulkSalesId, setBulkSalesId] = useState('')
  const [choices, setChoices] = useState<Record<number, string>>({})
  const [move, setMove] = useState<MoveRequest | null>(null)
  const [editingDirector, setEditingDirector] = useState<number | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/relationships', { cache: 'no-store' })
    const payload = await response.json().catch(() => null)
    if (!response.ok || !payload) { setError(payload?.error ?? 'Unable to load relationships'); return }
    setError(null)
    setData(payload)
  }, [])

  useEffect(() => { void load() }, [load])

  const salesById = useMemo(() => new Map((data?.sales ?? []).map((sales) => [sales.id, sales])), [data])
  const doctorById = useMemo(() => new Map((data?.doctors ?? []).map((doctor) => [doctor.id, doctor])), [data])
  const activeSales = useMemo(() => (data?.sales ?? []).filter((sales) => sales.isActive), [data])
  const directorOf = useMemo(() => {
    const map = new Map<number, string>()
    for (const director of data?.directors ?? []) for (const salesId of director.salesIds) map.set(salesId, director.name)
    return map
  }, [data])

  const query = search.trim().toLowerCase()
  const matches = useCallback((doctor: Doctor) => !query || [doctor.name, doctor.email, doctor.clinicName, doctor.country, doctor.city]
    .some((value) => value?.toLowerCase().includes(query)), [query])

  if (error && !data) return <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
  if (!data) return <BoardSkeleton />

  const canEdit = data.canEdit
  const unassigned = data.doctors.filter((doctor) => doctor.salesId === null)
  const visibleUnassigned = unassigned.filter(matches)
  const issues = data.issues.filter((issue) => issue.kind !== 'unassigned_with_orders')
  const salesName = (id: number | null) => (id ? salesById.get(id)?.name : null) ?? 'Unassigned'

  const assign = async (doctorIds: number[], salesId: number | null, moveOrders = true) => {
    setBusy(true)
    setError(null)
    const response = await fetch('/api/admin/relationships/doctors', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doctorIds, salesId, moveOrders }),
    })
    const payload = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) { setError(payload.error ?? 'Unable to update the sales rep'); return false }
    const who = doctorIds.length === 1 ? doctorById.get(doctorIds[0])?.name ?? 'Doctor' : plural(doctorIds.length, 'doctor')
    setToast(salesId ? `${who} → ${salesName(salesId)}${payload.moved ? ` · ${plural(payload.moved, 'order')} moved` : ''}` : `${who} unassigned`)
    setSelected((current) => current.filter((id) => !doctorIds.includes(id)))
    await load()
    return true
  }

  const fix = async (doctorIds?: number[]) => {
    setBusy(true)
    setError(null)
    const response = await fetch('/api/admin/relationships/fix', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doctorIds ? { doctorIds } : {}),
    })
    const payload = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) { setError(payload.error ?? 'Unable to fix the orders'); return }
    setToast(`${plural(payload.fixed ?? 0, 'order')} updated`)
    await load()
  }

  const saveDirector = async (director: Director, salesIds: number[]) => {
    setBusy(true)
    setError(null)
    const response = await fetch(`/api/admin/accounts/${director.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignedSalesIds: salesIds }),
    })
    const payload = await response.json().catch(() => ({}))
    setBusy(false)
    if (!response.ok) { setError(payload.error ?? 'Unable to update the team'); return }
    setEditingDirector(null)
    setToast(`${director.name}'s team updated`)
    await load()
  }

  const requestMove = (doctor: Doctor, value: string) => {
    const salesId = value ? Number(value) : null
    if (salesId === doctor.salesId) return
    setMove({ doctor, salesId })
  }

  const allIssueDoctorIds = [...new Set(issues.map((issue) => issue.doctorId))]
  const assignedCount = data.doctors.length - unassigned.length

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">
        <Stat label="Doctors" value={data.doctors.length} />
        <Stat label="With a sales rep" value={assignedCount} />
        <Stat label="Unassigned" value={unassigned.length} tone={unassigned.length ? 'warn' : 'ok'} />
        <Stat label="Order mismatches" value={allIssueDoctorIds.length} tone={allIssueDoctorIds.length ? 'warn' : 'ok'} />
      </div>
      <label className="relative w-full sm:w-72">
        <span className="sr-only">Search doctors</span>
        <span className="pointer-events-none absolute left-3 top-2.5"><MorphIcon icon={Search} className="h-4 w-4 text-text-muted" /></span>
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search doctor, clinic or country" className="h-9 w-full rounded-card border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-text focus:ring-2 focus:ring-text/10" />
      </label>
    </div>

    {error && <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    {!canEdit && <p className="rounded-card border border-border bg-bg px-4 py-2.5 text-sm text-text-muted">Only a Superadmin can change who serves whom.</p>}

    {issues.length > 0 && <section className="overflow-hidden rounded-card border border-amber-200 bg-amber-50/60">
      <header className="flex flex-col gap-2 border-b border-amber-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2.5">
          <MorphIcon icon={TriangleAlert} className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div><h2 className="text-sm font-semibold text-text">Orders that don&apos;t match the doctor&apos;s sales rep</h2><p className="mt-0.5 text-xs text-text-muted">The doctor&apos;s sales rep decides who sees their orders. Fixing moves the orders to that rep.</p></div>
        </div>
        {canEdit && <button type="button" disabled={busy} onClick={() => void fix()} className={darkButton}><MorphIcon icon={Wrench} className="h-4 w-4" />Fix all</button>}
      </header>
      <ul className="divide-y divide-amber-200/70">
        {issues.map((issue) => {
          const doctor = doctorById.get(issue.doctorId)
          return <li key={`${issue.kind}-${issue.doctorId}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text">{doctor?.name ?? `Doctor #${issue.doctorId}`}</p>
              <p className="text-xs text-text-muted">{issue.kind === 'orders_missing_sales'
                ? `${plural(issue.orderCount, 'order')} without a sales rep → ${salesName(issue.salesId)}`
                : `${plural(issue.orderCount, 'order')} under ${issue.otherSalesIds.map(salesName).join(', ')} → ${salesName(issue.salesId)}`}</p>
            </div>
            {canEdit && <button type="button" disabled={busy} onClick={() => void fix([issue.doctorId])} className={lightButton}>Fix</button>}
          </li>
        })}
      </ul>
    </section>}

    <section className="overflow-hidden rounded-card border border-border bg-surface">
      <header className="flex flex-col gap-1 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <MorphIcon icon={UserPlus} className="h-4 w-4 text-text-muted" />
          <h2 className="text-sm font-semibold text-text">Doctors without a sales rep</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${unassigned.length ? 'bg-primary/10 text-primary' : 'bg-bg text-text-muted'}`}>{unassigned.length}</span>
        </div>
        <p className="text-xs text-text-muted">No one on the sales team sees these doctors or their orders yet.</p>
      </header>
      {visibleUnassigned.length === 0
        ? <div className="flex items-center gap-2 px-4 py-5 text-sm text-text-muted"><MorphIcon icon={CircleCheck} className="h-4 w-4 text-green-600" />{unassigned.length ? 'No match for this search.' : 'Every doctor has a sales rep.'}</div>
        : <>
          {canEdit && selected.length > 0 && <div className="flex flex-col gap-2 border-b border-border bg-bg px-4 py-2.5 sm:flex-row sm:items-center">
            <span className="text-sm font-medium text-text">{plural(selected.length, 'doctor')} selected</span>
            <div className="flex flex-1 gap-2 sm:justify-end">
              <select value={bulkSalesId} onChange={(event) => setBulkSalesId(event.target.value)} className={`${selectClass} sm:w-56`} aria-label="Sales rep for selected doctors">
                <option value="">Choose sales rep…</option>
                {activeSales.map((sales) => <option key={sales.id} value={sales.id}>{sales.name}</option>)}
              </select>
              <button type="button" disabled={busy || !bulkSalesId} onClick={() => void assign(selected, Number(bulkSalesId)).then((ok) => ok && setBulkSalesId(''))} className={darkButton}>Assign</button>
            </div>
          </div>}
          <ul className="divide-y divide-border">
            {visibleUnassigned.map((doctor) => {
              const choice = choices[doctor.id] ?? (doctor.suggestedSalesId ? String(doctor.suggestedSalesId) : '')
              return <li key={doctor.id} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {canEdit && <input type="checkbox" checked={selected.includes(doctor.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, doctor.id] : current.filter((id) => id !== doctor.id))} className="mt-1 h-4 w-4 shrink-0 accent-text" aria-label={`Select ${doctor.name}`} />}
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-text"><span className="truncate">{doctor.name}</span>{!doctor.isActive && <InactiveTag />}</p>
                    <p className="truncate text-xs text-text-muted">{[doctor.clinicName, [doctor.city, doctor.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || doctor.email}</p>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
                      <span>Joined {new Date(doctor.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      {doctor.orderCount > 0 && <span>{plural(doctor.orderCount, 'order')}</span>}
                      {doctor.salesReferral && <span className="text-text">Named at sign-up: <span className="font-medium">{doctor.salesReferral}</span></span>}
                      {doctor.suggestionSource === 'orders' && doctor.suggestedSalesId && <span className="text-text">Orders filed under <span className="font-medium">{salesName(doctor.suggestedSalesId)}</span></span>}
                    </p>
                  </div>
                </div>
                {canEdit && <div className="flex gap-2 md:w-80">
                  <select value={choice} onChange={(event) => setChoices((current) => ({ ...current, [doctor.id]: event.target.value }))} className={selectClass} aria-label={`Sales rep for ${doctor.name}`}>
                    <option value="">Choose sales rep…</option>
                    {activeSales.map((sales) => <option key={sales.id} value={sales.id}>{sales.name}{sales.id === doctor.suggestedSalesId ? ' (suggested)' : ''}</option>)}
                  </select>
                  <button type="button" disabled={busy || !choice} onClick={() => void assign([doctor.id], Number(choice))} className={darkButton}><MorphIcon icon={Check} className="h-4 w-4" />Assign</button>
                </div>}
              </li>
            })}
          </ul>
        </>}
    </section>

    {data.directors.length > 0 && <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text"><MorphIcon icon={Network} className="h-4 w-4 text-text-muted" />Sales directors</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {data.directors.map((director) => <DirectorCard key={director.id} director={director} sales={data.sales.filter((sales) => sales.role === 'sales')} salesById={salesById} canEdit={canEdit} busy={busy} editing={editingDirector === director.id} onEdit={() => setEditingDirector(director.id)} onCancel={() => setEditingDirector(null)} onSave={(ids) => void saveDirector(director, ids)} />)}
      </div>
    </section>}

    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text"><MorphIcon icon={UsersRound} className="h-4 w-4 text-text-muted" />Sales reps and their doctors</h2>
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {data.sales.map((sales) => {
          const doctors = data.doctors.filter((doctor) => doctor.salesId === sales.id || doctor.extraSalesIds.includes(sales.id))
          const shown = doctors.filter(matches)
          if (query && shown.length === 0) return null
          return <article key={sales.id} className={`flex flex-col overflow-hidden rounded-card border border-border bg-surface ${sales.isActive ? '' : 'opacity-70'}`}>
            <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-text text-xs font-semibold text-white">{initials(sales.name)}</span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold text-text">{sales.name}{!sales.isActive && <InactiveTag />}</p>
                  <p className="truncate text-xs text-text-muted">{[sales.role === 'sales_director' ? 'Sales Director' : 'Sales', directorOf.get(sales.id) ? `Team of ${directorOf.get(sales.id)}` : null, sales.country].filter(Boolean).join(' · ')}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-bg px-2 py-0.5 text-xs font-semibold text-text">{plural(doctors.length, 'doctor')}</span>
            </header>
            {shown.length === 0
              ? <p className="px-4 py-5 text-sm text-text-muted">No doctors yet.</p>
              : <ul className="max-h-[420px] divide-y divide-border overflow-y-auto overscroll-contain">
                {shown.map((doctor) => <li key={doctor.id} className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-text"><MorphIcon icon={UserRound} className="h-3.5 w-3.5 shrink-0 text-text-muted" /><span className="truncate">{doctor.name}</span>{!doctor.isActive && <InactiveTag />}</p>
                    <p className="truncate pl-[22px] text-xs text-text-muted">{[doctor.clinicName, doctor.country, doctor.orderCount ? plural(doctor.orderCount, 'order') : null].filter(Boolean).join(' · ')}</p>
                    {doctor.staff.length > 0 && <p className="truncate pl-[22px] text-xs text-text-muted">Clinic staff: {doctor.staff.map((staff) => staff.name).join(', ')}</p>}
                    {doctor.salesId !== sales.id && <p className="pl-[22px] text-xs text-amber-700">Also served by {salesName(doctor.salesId)}</p>}
                  </div>
                  {canEdit && <label className="flex items-center gap-1.5 sm:w-44">
                    <MorphIcon icon={ArrowLeftRight} className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                    <span className="sr-only">Move {doctor.name} to another sales rep</span>
                    <select value={doctor.salesId ?? ''} disabled={busy} onChange={(event) => requestMove(doctor, event.target.value)} className={`${selectClass} h-8 text-xs`}>
                      {activeSales.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                      {doctor.salesId && !salesById.get(doctor.salesId)?.isActive && <option value={doctor.salesId}>{salesName(doctor.salesId)}</option>}
                      <option value="">Unassigned</option>
                    </select>
                  </label>}
                </li>)}
              </ul>}
          </article>
        })}
      </div>
    </section>

    {move && <MoveDialog move={move} fromName={salesName(move.doctor.salesId)} toName={salesName(move.salesId)} busy={busy} onCancel={() => setMove(null)} onConfirm={(moveOrders) => void assign([move.doctor.id], move.salesId, moveOrders).then((ok) => ok && setMove(null))} />}
    {toast && <Toast message={toast} onClose={() => setToast(null)} />}
  </div>
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' }) {
  const toneClass = tone === 'warn' && value > 0 ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border bg-surface text-text'
  return <div className={`rounded-card border px-3 py-1.5 ${toneClass}`}><span className="text-base font-semibold tabular-nums">{value}</span><span className="ml-1.5 text-xs text-text-muted">{label}</span></div>
}

function InactiveTag() {
  return <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">Inactive</span>
}

function initials(name: string) {
  return name.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?'
}

function DirectorCard({ director, sales, salesById, canEdit, busy, editing, onEdit, onCancel, onSave }: {
  director: Director
  sales: SalesAccount[]
  salesById: Map<number, SalesAccount>
  canEdit: boolean
  busy: boolean
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (salesIds: number[]) => void
}) {
  const [draft, setDraft] = useState(director.salesIds)
  useEffect(() => { if (editing) setDraft(director.salesIds) }, [editing, director.salesIds])
  return <article className="rounded-card border border-border bg-surface px-4 py-3">
    <div className="flex items-center justify-between gap-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-text">{director.name}{!director.isActive && <InactiveTag />}</p>
      {canEdit && !editing && <button type="button" onClick={onEdit} className="text-xs font-semibold text-text underline-offset-2 hover:underline">Edit team</button>}
    </div>
    {editing
      ? <div className="mt-2 space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {sales.map((option) => {
            const on = draft.includes(option.id)
            return <button key={option.id} type="button" onClick={() => setDraft((current) => on ? current.filter((id) => id !== option.id) : [...current, option.id])} className={`inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium ${on ? 'border-text bg-text text-white' : 'border-border bg-surface text-text hover:bg-bg'}`} aria-pressed={on}>{on && <MorphIcon icon={Check} className="h-3 w-3" />}{option.name}</button>
          })}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onCancel} className={lightButton}>Cancel</button>
          <button type="button" disabled={busy} onClick={() => onSave(draft)} className={darkButton}><MorphIcon icon={Save} hoverIcon={BadgeCheck} className="h-4 w-4" />Save team</button>
        </div>
      </div>
      : <div className="mt-2 flex flex-wrap gap-1.5">
        {director.salesIds.length === 0 && <span className="text-xs text-text-muted">No sales reps in this team yet.</span>}
        {director.salesIds.map((id) => <span key={id} className="rounded-full bg-bg px-2.5 py-1 text-xs font-medium text-text">{salesById.get(id)?.name ?? `#${id}`}</span>)}
      </div>}
  </article>
}

function MoveDialog({ move, fromName, toName, busy, onCancel, onConfirm }: { move: MoveRequest; fromName: string; toName: string; busy: boolean; onCancel: () => void; onConfirm: (moveOrders: boolean) => void }) {
  const [moveOrders, setMoveOrders] = useState(true)
  const orders = move.doctor.orderCount
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <div role="dialog" aria-modal="true" aria-labelledby="move-doctor-title" className="w-full max-w-md rounded-card border border-border bg-surface">
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div><h2 id="move-doctor-title" className="text-base font-semibold text-text">{move.salesId ? 'Change sales rep' : 'Remove sales rep'}</h2><p className="mt-1 text-sm text-text-muted">{move.doctor.name}</p></div>
        <button type="button" title="Close" disabled={busy} onClick={onCancel} className="grid h-8 w-8 shrink-0 place-items-center rounded text-text-muted hover:bg-bg hover:text-text disabled:opacity-40"><MorphIcon icon={X} className="h-4 w-4" /></button>
      </header>
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3 text-sm">
          <span className="min-w-0 flex-1 truncate rounded-card border border-border bg-bg px-3 py-2 text-text-muted">{fromName}</span>
          <MorphIcon icon={ArrowLeftRight} className="h-4 w-4 shrink-0 text-text-muted" />
          <span className="min-w-0 flex-1 truncate rounded-card border border-text px-3 py-2 font-medium text-text">{toName}</span>
        </div>
        {move.salesId
          ? orders > 0 && <label className="flex cursor-pointer items-start gap-2.5 rounded-card border border-border px-3 py-2.5 text-sm text-text">
            <input type="checkbox" checked={moveOrders} onChange={(event) => setMoveOrders(event.target.checked)} className="mt-0.5 h-4 w-4 accent-text" />
            <span>Also move {plural(orders, 'existing order')} to {toName}<span className="mt-0.5 block text-xs text-text-muted">Recommended. Otherwise {fromName} keeps seeing the old orders.</span></span>
          </label>
          : <p className="text-sm text-text-muted">No one on the sales team will see this doctor until a new rep is assigned. Existing orders keep their current sales rep.</p>}
      </div>
      <footer className="flex justify-end gap-2 border-t border-border px-5 py-4">
        <button type="button" disabled={busy} onClick={onCancel} className={lightButton}>Cancel</button>
        <button type="button" disabled={busy} onClick={() => onConfirm(moveOrders)} className={darkButton}>{busy ? 'Saving…' : 'Confirm'}</button>
      </footer>
    </div>
  </div>
}

function BoardSkeleton() {
  return <div className="space-y-4" aria-busy="true">
    <div className="flex gap-2">{[0, 1, 2, 3].map((key) => <div key={key} className="h-9 w-28 animate-pulse rounded-card bg-bg" />)}</div>
    <div className="h-40 animate-pulse rounded-card bg-bg" />
    <div className="grid gap-3 lg:grid-cols-2">{[0, 1].map((key) => <div key={key} className="h-56 animate-pulse rounded-card bg-bg" />)}</div>
  </div>
}
