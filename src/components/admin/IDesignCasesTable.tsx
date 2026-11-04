'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CirclePlus, ExternalLink, Plus, Search } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { usePathname } from 'next/navigation'
import { IDESIGN_PROGRESS_STYLES } from '@/lib/idesign/orders'
import { getIDesignPlanHref } from '@/lib/idesign/planLinks'
import { IDesignNotifications } from '@/components/idesign/IDesignNotifications'

interface CaseRow {
  id: number
  orderNo: string
  patientName: string
  gender: string | null
  dateOfBirth: string | null
  latestProgress: string
  planReviewStatus: string
  currentPlanVersion: number | null
  course: { status: string; currentStep: number; totalSteps: number } | null
  updateTime: string
  doctorName: string | null
}

export function IDesignCasesTable() {
  const pathname = usePathname()
  const newHref = pathname.startsWith('/portal') ? '/portal/idesign/orders/new' : '/admin/idesign/orders/new'
  const detailBase = pathname.startsWith('/portal') ? '/portal/idesign/orders' : '/admin/idesign/orders'
  const [cases, setCases] = useState<CaseRow[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [canEditUpdateTime, setCanEditUpdateTime] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      const response = await fetch(`/api/idesign/cases?${params}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to load clear aligner orders')
      setCases(payload.cases)
      setTotal(payload.pagination.total)
      setTotalPages(payload.pagination.totalPages)
      setCanEditUpdateTime(Boolean(payload.permissions?.canEditUpdateTime))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load clear aligner orders')
    } finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { const timer = setTimeout(load, search ? 250 : 0); return () => clearTimeout(timer) }, [load, search])

  return <section className="space-y-4">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-xl font-semibold text-text">iDesign | Clear Aligners</h1><p className="mt-1 text-sm text-text-muted">{loading ? 'Loading orders...' : `${total} clear aligner order${total === 1 ? '' : 's'}`}</p></div><div className="flex items-center gap-2"><IDesignNotifications /><Link href={newHref} className="inline-flex h-10 items-center justify-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-orange-600"><MorphIcon icon={Plus} hoverIcon={CirclePlus} className="h-4 w-4" />New Order</Link></div></header>
    <div className="rounded-card border border-border bg-surface p-3"><label className="relative block max-w-md"><span className="sr-only">Search clear aligner orders</span><span className="pointer-events-none absolute left-3 top-3"><MorphIcon icon={Search} className="h-4 w-4 text-text-muted" /></span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search patient or order number" className="h-10 w-full rounded-card border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-text focus:ring-2 focus:ring-text/10" /></label></div>
    {error && <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="overflow-hidden rounded-card border border-border bg-surface"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold text-text">Clinical Cases</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[1080px]"><thead className="border-b border-border bg-bg text-left text-xs font-semibold uppercase text-text-muted"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Date of birth</th><th className="px-4 py-3">Doctor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Treatment Plan</th><th className="px-4 py-3">Wear Schedule</th><th className="px-4 py-3">Update Time</th></tr></thead><tbody>{loading ? <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-text-muted">Loading orders...</td></tr> : cases.length === 0 ? <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-text-muted">No clear aligner orders yet</td></tr> : cases.map((item) => <tr key={item.id} className="border-b border-border last:border-0 hover:bg-bg/60"><td className="px-4 py-3"><Link href={`${detailBase}/${item.id}`} className="text-sm font-semibold text-text underline-offset-4 hover:underline">{item.orderNo}</Link></td><td className="px-4 py-3"><p className="text-sm font-medium text-text">{item.patientName}</p><p className="text-xs text-text-muted">{item.gender || 'Not recorded'}</p></td><td className="px-4 py-3 text-sm text-text-muted">{formatDate(item.dateOfBirth)}</td><td className="px-4 py-3 text-sm text-text">{item.doctorName || 'Unassigned'}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${IDESIGN_PROGRESS_STYLES[item.latestProgress] ?? 'border-border bg-bg text-text-muted'}`}>{item.latestProgress}</span></td><td className="px-4 py-3">{item.currentPlanVersion ? <a href={getIDesignPlanHref(item.id)} target="_blank" rel="noreferrer" aria-label={`Open treatment plan V${item.currentPlanVersion} for ${item.patientName}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-text underline-offset-4 hover:underline"><span>V{item.currentPlanVersion}</span><MorphIcon icon={ExternalLink} className="h-3.5 w-3.5" /></a> : <p className="text-sm font-medium text-text">No plan</p>}<p className="mt-0.5 text-xs capitalize text-text-muted">{item.planReviewStatus.replaceAll('_', ' ')}</p></td><td className="px-4 py-3"><p className="text-sm text-text">{item.course ? `Step ${item.course.currentStep} of ${item.course.totalSteps}` : 'Not started'}</p>{item.course && <p className="text-xs capitalize text-text-muted">{item.course.status}</p>}</td><td className="px-4 py-3 text-sm text-text-muted">{canEditUpdateTime ? <InlineUpdateTime caseId={item.id} value={item.updateTime} onSaved={load} onError={setError} /> : formatDate(item.updateTime)}</td></tr>)}</tbody></table></div><footer className="flex items-center justify-between border-t border-border px-4 py-3"><p className="text-xs text-text-muted">Page {page} of {totalPages}</p><div className="flex gap-1"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="grid h-8 w-8 place-items-center rounded border border-border text-text-muted hover:bg-bg disabled:opacity-40" title="Previous page"><MorphIcon icon={ChevronLeft} hoverIcon={ChevronsLeft} className="h-4 w-4" /></button><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading} className="grid h-8 w-8 place-items-center rounded border border-border text-text-muted hover:bg-bg disabled:opacity-40" title="Next page"><MorphIcon icon={ChevronRight} hoverIcon={ChevronsRight} className="h-4 w-4" /></button></div></footer></div>
  </section>
}

function InlineUpdateTime({ caseId, value, onSaved, onError }: { caseId: number; value: string; onSaved: () => Promise<void>; onError: (message: string | null) => void }) {
  const [date, setDate] = useState(toDateInputValue(value))
  const [saving, setSaving] = useState(false)

  useEffect(() => setDate(toDateInputValue(value)), [value])

  const save = async (nextDate: string) => {
    setDate(nextDate)
    if (!nextDate) return
    setSaving(true)
    onError(null)
    const response = await fetch(`/api/idesign/cases/${caseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updateTime: nextDate }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) onError(payload.error || 'Unable to update the date')
    else await onSaved()
    setSaving(false)
  }

  return <input type="date" value={date} disabled={saving} onChange={(event) => void save(event.target.value)} aria-label="Update time" title="Changes save automatically" className="h-8 w-[138px] rounded border border-border bg-surface px-2 text-xs text-text outline-none focus:border-text disabled:opacity-50" />
}

function toDateInputValue(value: string | null) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

function formatDate(value: string | null) { if (!value) return '—'; const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) }
