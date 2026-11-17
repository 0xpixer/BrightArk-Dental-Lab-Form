'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, ChevronsRight, CirclePlus, Eye, PanelRightOpen, Plus, Search } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { IDESIGN_VIEW_BUTTON_CLASS } from '@/components/idesign/IDesignTreatmentPlans'
import { Toast } from '@/components/admin/Toast'
import { CRM_STATUS_LABELS, type CrmStatus } from '@/lib/crm/crm'
import { CrmApiBase, EditableValue, FollowUpBadge, OrdersSummary, SourceBadge, StatusBadge } from './CrmCells'
import { CrmCreateSheet, CrmEditSheet } from './CrmSheet'
import {
  CRM_FIELD_DEFS, CRM_LEAD_FIELDS, CRM_OWNER_FIELD, localToday, lockReason,
  type CrmOptions, type CrmRow, type CrmValue, type CrmViewer,
} from './crmTypes'

const FOLLOW_UP_OPTIONS = [
  { value: 'due', label: 'Due today or earlier' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'week', label: 'Next 7 days' },
  { value: 'none', label: 'Not scheduled' },
]

const SELECT_CLASS = 'h-11 w-full min-w-0 rounded-card border border-border bg-surface px-3 text-base text-text md:text-sm outline-none focus:border-text focus:ring-2 focus:ring-text/10 md:h-10'

export function CrmBoard({ apiBase = '/api/crm/doctors' }: { apiBase?: string }) {
  const [rows, setRows] = useState<CrmRow[]>([])
  const [options, setOptions] = useState<CrmOptions>({ statuses: [], countries: [], owners: [] })
  const [viewer, setViewer] = useState<CrmViewer | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [country, setCountry] = useState('')
  const [salesId, setSalesId] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    try {
      const params = new URLSearchParams({ today: localToday() })
      if (search.trim()) params.set('search', search.trim())
      if (status) params.set('status', status)
      if (country) params.set('country', country)
      if (salesId) params.set('salesId', salesId)
      if (followUp) params.set('followUp', followUp)
      const response = await fetch(`${apiBase}?${params}`)
      const payload = await response.json().catch(() => ({}))
      if (current !== requestId.current) return
      if (!response.ok) throw new Error(payload.error ?? 'Could not load the CRM')
      setRows(payload.rows)
      setOptions(payload.options)
      setViewer(payload.viewer)
      setTruncated(payload.truncated)
      setError('')
    } catch (loadError) {
      if (current === requestId.current) setError(loadError instanceof Error ? loadError.message : 'Could not load the CRM')
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [apiBase, search, status, country, salesId, followUp])

  useEffect(() => {
    const timer = setTimeout(() => { void load() }, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, search])

  /** Optimistic inline save: apply locally, PATCH, then take the server row or roll the field back. */
  const saveField = useCallback(async (id: number, field: string, value: CrmValue) => {
    let before: CrmRow | undefined
    setRows((current) => current.map((row) => {
      if (row.id !== id) return row
      before = row
      const next = { ...row, [field]: value } as CrmRow
      if (field === 'salesId') next.ownerName = options.owners.find((owner) => owner.id === value)?.name ?? row.ownerName
      return next
    }))
    try {
      const response = await fetch(`${apiBase}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Could not save the change')
      if (payload.row) setRows((current) => current.map((row) => row.id === id ? payload.row : row))
    } catch (saveError) {
      setRows((current) => current.map((row) => row.id === id && before
        ? { ...row, [field]: before[field as keyof CrmRow], ownerName: before.ownerName } as CrmRow
        : row))
      setToast(saveError instanceof Error ? saveError.message : 'Could not save the change')
    }
  }, [apiBase, options.owners])

  async function createRecord(values: Record<string, unknown>) {
    const response = await fetch(apiBase, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) return payload.error ?? 'Could not add the doctor'
    setCreating(false)
    if (payload.row) {
      setRows((current) => [payload.row, ...current])
      setToast(payload.row.doctorAccountId ? `${payload.row.fullName} added and linked to their account` : `${payload.row.fullName} added`)
    }
    return null
  }

  async function deleteRecord(id: number) {
    const response = await fetch(`${apiBase}/${id}`, { method: 'DELETE' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) { setToast(payload.error ?? 'Could not delete the record'); return }
    setOpenId(null)
    setRows((current) => current.filter((row) => row.id !== id))
    setToast('Record deleted')
  }

  const defs = useMemo(() => viewer?.canChooseOwner ? [...CRM_FIELD_DEFS, CRM_OWNER_FIELD] : CRM_FIELD_DEFS, [viewer])
  const leadDefs = defs.filter((def) => CRM_LEAD_FIELDS.has(def.key))
  const restDefs = defs.filter((def) => !CRM_LEAD_FIELDS.has(def.key))
  const cell = (row: CrmRow, def: (typeof defs)[number], sticky: boolean) => (
    <td key={def.key} className={`px-1 py-1.5 ${def.width} ${sticky ? 'sticky left-0 z-10 bg-surface font-medium group-hover:bg-[#fafafa]' : ''}`}>
      <EditableValue def={def} row={row} owners={options.owners} lock={lockReason(row, def.key)} writeThrough={row.fieldAccess.writeThrough.includes(def.key)} variant="cell" onSave={(value) => saveField(row.id, def.key, value)} />
    </td>
  )
  const openRow = rows.find((row) => row.id === openId) ?? null
  const dueCount = rows.filter((row) => row.nextFollowUp && row.nextFollowUp <= localToday()).length
  const filtersActive = Boolean(search || status || country || salesId || followUp)

  return (
    <CrmApiBase.Provider value={apiBase}>
    <section className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Doctor CRM</h1>
          <p className="mt-1 text-sm text-text-muted">{loading && rows.length === 0 ? 'Loading doctors…' : <>{`${rows.length}${truncated ? '+' : ''} doctors${dueCount ? ` · ${dueCount} follow-up${dueCount === 1 ? '' : 's'} due` : ''}`}<span className="hidden md:inline"> · click any cell to edit</span><span className="md:hidden"> · tap a doctor to edit</span></>}</p>
        </div>
        <button type="button" onClick={() => setCreating(true)} disabled={!viewer} className="inline-flex h-11 items-center justify-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40 md:h-10"><MorphIcon icon={Plus} hoverIcon={CirclePlus} className="h-4 w-4" />Add doctor</button>
      </header>

      <section className="rounded-card border border-border bg-surface p-3">
        <div className={`grid grid-cols-2 gap-2 ${viewer?.canChooseOwner ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
          <label className="relative col-span-2 xl:col-span-1">
            <span className="sr-only">Search doctors</span>
            <span className="pointer-events-none absolute left-3 top-3.5 md:top-3"><MorphIcon icon={Search} className="h-4 w-4 text-text-muted" /></span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search doctors" className={`${SELECT_CLASS} pl-9`} />
          </label>
          <select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)} className={SELECT_CLASS}>
            <option value="">Status</option>
            {options.statuses.map((value) => <option key={value} value={value}>{CRM_STATUS_LABELS[value as CrmStatus] ?? value}</option>)}
          </select>
          <select aria-label="Country" value={country} onChange={(event) => setCountry(event.target.value)} className={SELECT_CLASS}>
            <option value="">Country</option>
            {options.countries.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          {viewer?.canChooseOwner && <select aria-label="Sales rep" value={salesId} onChange={(event) => setSalesId(event.target.value)} className={SELECT_CLASS}>
            <option value="">Sales rep</option>
            {options.owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
          </select>}
          <select aria-label="Follow-up" value={followUp} onChange={(event) => setFollowUp(event.target.value)} className={`${SELECT_CLASS} ${viewer?.canChooseOwner ? '' : 'col-span-2 xl:col-span-1'}`}>
            <option value="">Follow-up</option>
            {FOLLOW_UP_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </section>

      {error && <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {truncated && <div role="status" className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Showing the first 500 doctors. Use search or filters to narrow the list.</div>}

      <section className="overflow-hidden rounded-card border border-border bg-surface">
        {/* Phones: stacked cards; editing happens in the bottom sheet. */}
        <div className="divide-y divide-border md:hidden">
          {rows.length === 0
            ? <p className="px-4 py-12 text-center text-sm text-text-muted">{loading ? 'Loading doctors…' : filtersActive ? 'No matching doctors' : 'No doctors yet. Add your first doctor.'}</p>
            : rows.map((row) => (
              <button key={row.id} type="button" onClick={() => setOpenId(row.id)} className="block w-full px-4 py-3 text-left active:bg-bg">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text">{row.fullName}</p>
                    <p className="truncate text-xs text-text-muted">{[row.clinicName, row.city, row.country].filter(Boolean).join(' · ') || row.email || 'No details yet'}</p>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="text-text-muted">Follow-up: <FollowUpBadge date={row.nextFollowUp} /></span>
                  {viewer?.canChooseOwner && <span className="text-text-muted">Rep: {row.ownerName}</span>}
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2"><OrdersSummary row={row} compact /><MorphIcon icon={ChevronRight} hoverIcon={ChevronsRight} className="h-4 w-4 shrink-0 text-text-muted" /></div>
              </button>
            ))}
        </div>

        <div className="relative hidden overflow-x-auto md:block">
          <table className={`w-full ${viewer?.canChooseOwner ? 'min-w-[2280px]' : 'min-w-[2120px]'}`}>
            <thead className="border-b border-border bg-bg text-left text-xs font-semibold uppercase text-text-muted">
              <tr>
                {leadDefs.map((def, index) => <th key={def.key} className={`px-2 py-3 ${def.width} ${index === 0 ? 'sticky left-0 z-10 bg-bg' : ''}`}>{def.label}</th>)}
                <th className="w-48 px-2 py-3">Orders</th>
                {restDefs.map((def) => <th key={def.key} className={`px-2 py-3 ${def.width}`}>{def.label}</th>)}
                <th className="w-32 px-2 py-3">Source</th>
                <th className="w-24 px-2 py-3"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0
                ? <tr><td colSpan={defs.length + 3} className="px-4 py-12 text-center text-sm text-text-muted">{loading ? 'Loading doctors…' : filtersActive ? 'No matching doctors' : 'No doctors yet. Add your first doctor.'}</td></tr>
                : rows.map((row) => (
                  <tr key={row.id} className="group border-b border-border align-top last:border-0 hover:bg-bg/60">
                    {leadDefs.map((def, index) => cell(row, def, index === 0))}
                    <td className="px-2 py-2.5"><OrdersSummary row={row} /></td>
                    {restDefs.map((def) => cell(row, def, false))}
                    <td className="px-2 py-2.5"><SourceBadge row={row} /></td>
                    <td className="px-2 py-2 text-right"><button type="button" onClick={() => setOpenId(row.id)} className={IDESIGN_VIEW_BUTTON_CLASS}><MorphIcon icon={Eye} hoverIcon={PanelRightOpen} className="h-3 w-3" />Open</button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {openRow && viewer && <CrmEditSheet row={openRow} viewer={viewer} options={options} onClose={() => setOpenId(null)} onSave={(field, value) => saveField(openRow.id, field, value)} onDelete={() => deleteRecord(openRow.id)} />}
      {creating && viewer && <CrmCreateSheet viewer={viewer} options={options} defaultSalesId={salesId ? Number(salesId) : null} onClose={() => setCreating(false)} onCreate={createRecord} />}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </section>
    </CrmApiBase.Provider>
  )
}
