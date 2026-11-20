'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { BellRing, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { batchOptions, PRODUCTION_INTERVAL_DAYS } from '@/lib/idesign/production'

interface ProductionRow {
  caseId: number
  orderNo: string
  patientName: string
  latestProgress: string
  isFree: boolean
  doctorName: string | null
  salesName: string | null
  totalStages: number | null
  suggestedTotalStages: number | null
  deliveredBatch: number | null
  batchDeliveredOn: string | null
  nextProductionDue: string | null
  notifiedForCurrentBatch: boolean
}

type Update = { totalStages: number | null } | { deliveredBatch: number | null } | { batchDeliveredOn: string | null }

export function AlignerProductionTable() {
  const [rows, setRows] = useState<ProductionRow[]>([])
  const [today, setToday] = useState('')
  const [search, setSearch] = useState('')
  const [dueOnly, setDueOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (search) params.set('search', search)
      if (dueOnly) params.set('filter', 'due')
      const response = await fetch(`/api/admin/idesign/production?${params}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to load production progress')
      setRows(payload.rows)
      setToday(payload.today)
      setTotal(payload.pagination.total)
      setTotalPages(payload.pagination.totalPages)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load production progress')
    } finally { setLoading(false) }
  }, [page, search, dueOnly])

  useEffect(() => { const timer = setTimeout(load, search ? 250 : 0); return () => clearTimeout(timer) }, [load, search])

  const update = async (caseId: number, body: Update) => {
    setSavingId(caseId)
    setError(null)
    const response = await fetch(`/api/admin/idesign/production/${caseId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error || 'Unable to save')
    await load()
    setSavingId(null)
  }

  return <section className="space-y-4">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-xl font-semibold text-text">Production Progress</h1><p className="mt-1 text-sm text-text-muted">{loading ? 'Loading orders...' : `${total} clear aligner order${total === 1 ? '' : 's'} · next batch due ${PRODUCTION_INTERVAL_DAYS} days after the current batch is delivered`}</p></div>
      <div className="flex items-center gap-2">
        <label className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-card border border-border bg-surface px-3 text-sm text-text"><input type="checkbox" checked={dueOnly} onChange={(event) => { setDueOnly(event.target.checked); setPage(1) }} className="h-4 w-4 accent-primary" />Due only</label>
        <label className="relative min-w-0 flex-1 sm:w-72 sm:flex-none"><span className="sr-only">Search orders</span><span className="pointer-events-none absolute left-3 top-3"><MorphIcon icon={Search} className="h-4 w-4 text-text-muted" /></span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search patient, order or doctor" className="h-10 w-full rounded-card border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-text focus:ring-2 focus:ring-text/10" /></label>
      </div>
    </header>
    {error && <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="overflow-x-auto"><table className="w-full min-w-[880px]">
        <thead className="border-b border-border bg-bg text-left text-xs font-semibold uppercase text-text-muted"><tr>
          <th className="px-4 py-3">Patient / Order No.</th><th className="px-4 py-3">Doctor</th><th className="px-4 py-3">Total Stages</th><th className="px-4 py-3">Delivered Stages</th><th className="px-4 py-3">Delivered Date</th><th className="px-4 py-3">Next Production Due</th>
        </tr></thead>
        <tbody>{loading && rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-text-muted">Loading orders...</td></tr> : rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-text-muted">No clear aligner orders</td></tr> : rows.map((row) => {
          const saving = savingId === row.caseId
          const effectiveTotal = row.totalStages ?? row.suggestedTotalStages
          const due = row.nextProductionDue
          const overdue = Boolean(due && today && due <= today)
          return <tr key={row.caseId} className="border-b border-border last:border-0 align-middle">
            <td className="px-4 py-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-text">{row.patientName}{row.isFree && <span className="rounded-full border border-sky-200 bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-sky-800">Free</span>}</div>
              <Link href={`/admin/idesign/orders/${row.caseId}`} className="mt-0.5 inline-block text-xs text-text-muted underline-offset-4 hover:text-text hover:underline">{row.orderNo}</Link>
            </td>
            <td className="px-4 py-3 text-sm text-text-muted">{row.doctorName || '-'}</td>
            <td className="px-4 py-3"><TotalStagesInput value={row.totalStages} placeholder={row.suggestedTotalStages} disabled={saving} onSave={(value) => void update(row.caseId, { totalStages: value })} /></td>
            <td className="px-4 py-3"><select value={row.deliveredBatch ?? ''} disabled={saving} onChange={(event) => void update(row.caseId, { deliveredBatch: event.target.value ? Number(event.target.value) : null })} aria-label={`Delivered stages for ${row.patientName}`} className="h-8 w-[120px] rounded border border-border bg-surface px-2 text-xs text-text outline-none focus:border-text disabled:opacity-50">
              <option value="">Not delivered</option>
              {batchOptions(effectiveTotal).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select></td>
            <td className="px-4 py-3"><DeliveredDateInput value={row.batchDeliveredOn} disabled={saving} label={`Delivered date for ${row.patientName}`} onSave={(value) => void update(row.caseId, { batchDeliveredOn: value })} /></td>
            <td className="px-4 py-3 text-sm">{due ? <span className={`inline-flex items-center gap-1.5 ${overdue ? 'font-semibold text-red-600' : 'text-text'}`}>{due}{row.notifiedForCurrentBatch && <span title="Reminder email sent for this batch"><MorphIcon icon={BellRing} className="h-3.5 w-3.5 text-text-muted" /></span>}</span> : <span className="text-text-muted">-</span>}</td>
          </tr>
        })}</tbody>
      </table></div>
      <footer className="flex items-center justify-between border-t border-border px-4 py-3"><p className="text-xs text-text-muted">Page {page} of {totalPages}</p><div className="flex gap-1">
        <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="grid h-11 w-11 place-items-center rounded border border-border text-text-muted hover:bg-bg disabled:opacity-40 md:h-8 md:w-8" title="Previous page"><MorphIcon icon={ChevronLeft} hoverIcon={ChevronsLeft} className="h-4 w-4" /></button>
        <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading} className="grid h-11 w-11 place-items-center rounded border border-border text-text-muted hover:bg-bg disabled:opacity-40 md:h-8 md:w-8" title="Next page"><MorphIcon icon={ChevronRight} hoverIcon={ChevronsRight} className="h-4 w-4" /></button>
      </div></footer>
    </div>
  </section>
}

function TotalStagesInput({ value, placeholder, disabled, onSave }: { value: number | null; placeholder: number | null; disabled: boolean; onSave: (value: number | null) => void }) {
  const [draft, setDraft] = useState(value?.toString() ?? '')
  useEffect(() => setDraft(value?.toString() ?? ''), [value])
  const commit = () => {
    const trimmed = draft.trim()
    const next = trimmed ? Number(trimmed) : null
    if (next === value) return
    if (next !== null && (!Number.isInteger(next) || next < 1)) { setDraft(value?.toString() ?? ''); return }
    onSave(next)
  }
  return <input type="number" min={1} max={200} inputMode="numeric" value={draft} placeholder={placeholder?.toString() ?? ''} disabled={disabled} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }} aria-label="Total stages" title={placeholder && value === null ? `From the wear schedule or import: ${placeholder}. Saves on blur.` : 'Saves on blur'} className="h-8 w-20 rounded border border-border bg-surface px-2 text-xs text-text outline-none placeholder:text-text-muted/70 focus:border-text disabled:opacity-50" />
}

function DeliveredDateInput({ value, disabled, label, onSave }: { value: string | null; disabled: boolean; label: string; onSave: (value: string | null) => void }) {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => setDraft(value ?? ''), [value])
  const commit = () => { if ((draft || null) !== value) onSave(draft || null) }
  return <input type="date" value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} onBlur={commit} aria-label={label} title="Saves on blur" className="h-8 w-[138px] rounded border border-border bg-surface px-2 text-xs text-text outline-none focus:border-text disabled:opacity-50" />
}
