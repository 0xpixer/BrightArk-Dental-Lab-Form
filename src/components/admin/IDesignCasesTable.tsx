'use client'

import { Fragment, useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import Link from 'next/link'
import { BadgeCheck, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CirclePlus, Plus, Search, UserRound } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { usePathname } from 'next/navigation'
import { IDESIGN_PROGRESS_STYLES } from '@/lib/idesign/orders'
import { getIDesignPlanViewerHref } from '@/lib/idesign/planLinks'
import { IDesignNotifications } from '@/components/idesign/IDesignNotifications'
import { WearSchedulePanel } from '@/components/idesign/IDesignCaseDetail'
import { getIDesignPlanApprovalState } from '@/lib/idesign/approval'

interface CaseRow {
  id: number
  orderNo: string
  patientName: string
  gender: string | null
  latestProgress: string
  currentPlanVersion: number | null
  currentPlanStatus: string | null
  course: { status: string; currentStep: number; totalSteps: number } | null
  updateTime: string
  doctorName: string | null
  fileUrls: Record<string, Array<{ url: string; name: string }>> | null
  importedTotalSteps: number | null
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
  const [canApprovePlans, setCanApprovePlans] = useState(false)
  const [canEditUpdateTime, setCanEditUpdateTime] = useState(false)
  const [canManageSchedule, setCanManageSchedule] = useState(false)
  const [expandedScheduleId, setExpandedScheduleId] = useState<number | null>(null)
  const [approvalCase, setApprovalCase] = useState<CaseRow | null>(null)
  const [approving, setApproving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtersReady, setFiltersReady] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const savedPage = Number(params.get('page'))
    setSearch(params.get('search') ?? '')
    setPage(Number.isInteger(savedPage) && savedPage > 0 ? savedPage : 1)
    setFiltersReady(true)
  }, [])

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
      setCanApprovePlans(Boolean(payload.permissions?.canApprovePlans))
      setCanEditUpdateTime(Boolean(payload.permissions?.canEditUpdateTime))
      setCanManageSchedule(Boolean(payload.permissions?.canManageSchedule))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load clear aligner orders')
    } finally { setLoading(false) }
  }, [page, search])

  useEffect(() => {
    if (!filtersReady) return
    const timer = setTimeout(load, search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [filtersReady, load, search])

  const listParams = new URLSearchParams()
  if (search) listParams.set('search', search)
  if (page > 1) listParams.set('page', String(page))
  const returnTo = `${pathname}${listParams.size ? `?${listParams}` : ''}`

  const approvePlan = async () => {
    if (!approvalCase) return
    setApproving(true)
    setError(null)
    const response = await fetch(`/api/idesign/cases/${approvalCase.id}/plans`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error || 'Unable to approve the treatment plan')
    else {
      setApprovalCase(null)
      await load()
    }
    setApproving(false)
  }

  return <section className="space-y-4">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-xl font-semibold text-text">iDesign | Clear Aligners</h1><p className="mt-1 text-sm text-text-muted">{loading ? 'Loading orders...' : `${total} clear aligner order${total === 1 ? '' : 's'}`}</p></div><div className="flex items-center gap-2"><IDesignNotifications /><Link href={newHref} className="inline-flex h-10 items-center justify-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-orange-600"><MorphIcon icon={Plus} hoverIcon={CirclePlus} className="h-4 w-4" />New Order</Link></div></header>
    <div className="rounded-card border border-border bg-surface p-3"><label className="relative block max-w-md"><span className="sr-only">Search clear aligner orders</span><span className="pointer-events-none absolute left-3 top-3"><MorphIcon icon={Search} className="h-4 w-4 text-text-muted" /></span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search patient or order number" className="h-10 w-full rounded-card border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-text focus:ring-2 focus:ring-text/10" /></label></div>
    {error && <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <CasesTable cases={cases} loading={loading} detailBase={detailBase} returnTo={returnTo} canApprovePlans={canApprovePlans} canEditUpdateTime={canEditUpdateTime} canManageSchedule={canManageSchedule} expandedScheduleId={expandedScheduleId} setExpandedScheduleId={setExpandedScheduleId} setApprovalCase={setApprovalCase} reload={load} setError={setError} page={page} totalPages={totalPages} setPage={setPage} />
    {approvalCase && <ApprovalDialog item={approvalCase} approving={approving} onCancel={() => setApprovalCase(null)} onConfirm={() => void approvePlan()} />}
  </section>
}

function CasesTable({ cases, loading, detailBase, returnTo, canApprovePlans, canEditUpdateTime, canManageSchedule, expandedScheduleId, setExpandedScheduleId, setApprovalCase, reload, setError, page, totalPages, setPage }: {
  cases: CaseRow[]
  loading: boolean
  detailBase: string
  returnTo: string
  canApprovePlans: boolean
  canEditUpdateTime: boolean
  canManageSchedule: boolean
  expandedScheduleId: number | null
  setExpandedScheduleId: Dispatch<SetStateAction<number | null>>
  setApprovalCase: Dispatch<SetStateAction<CaseRow | null>>
  reload: () => Promise<void>
  setError: Dispatch<SetStateAction<string | null>>
  page: number
  totalPages: number
  setPage: Dispatch<SetStateAction<number>>
}) {
  return <div className="overflow-hidden rounded-card border border-border bg-surface">
    <div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold text-text">Clinical Cases</h2></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[940px]">
      <thead className="border-b border-border bg-bg text-left text-xs font-semibold uppercase text-text-muted"><tr><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Doctor</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Treatment Plan</th><th className="px-4 py-3">Est. Wear Schedule</th><th className="px-4 py-3">Update Time</th></tr></thead>
      <tbody>{loading ? <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-text-muted">Loading orders...</td></tr> : cases.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-text-muted">No clear aligner orders yet</td></tr> : cases.map((item) => {
        const approvalState = getIDesignPlanApprovalState(item.latestProgress, item.currentPlanStatus)
        const approvalEnabled = canApprovePlans && approvalState.readyForApproval
        const scheduleExpanded = expandedScheduleId === item.id && !item.course
        return <Fragment key={item.id}>
          <tr className="border-b border-border hover:bg-bg/60">
            <td className="px-4 py-3"><div className="flex items-center gap-3"><PatientAvatar name={item.patientName} files={item.fileUrls} /><div className="min-w-0"><Link href={`${detailBase}/${item.id}`} className="block truncate text-sm font-semibold text-text underline-offset-4 hover:underline">{item.patientName}</Link><p className="mt-0.5 truncate text-xs text-text-muted">{item.orderNo}{item.gender ? ` · ${item.gender}` : ''}</p></div></div></td>
            <td className="px-4 py-3 text-sm text-text">{item.doctorName || 'Unassigned'}</td>
            <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${IDESIGN_PROGRESS_STYLES[item.latestProgress] ?? 'border-border bg-bg text-text-muted'}`}>{item.latestProgress}</span></td>
            <td className="px-4 py-3">{item.currentPlanVersion ? <div className="flex w-fit flex-col items-start gap-2"><Link href={getIDesignPlanViewerHref(item.id, detailBase, returnTo)} aria-label={`View treatment plan V${item.currentPlanVersion} for ${item.patientName}`} className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded bg-text px-2.5 text-[11px] font-semibold text-white hover:bg-neutral-700">View Plan V{item.currentPlanVersion}</Link>{approvalState.approved ? <span className="px-0.5 text-xs font-medium text-text-muted">Approved</span> : <button type="button" disabled={!approvalEnabled} onClick={() => approvalEnabled && setApprovalCase(item)} className={`h-7 whitespace-nowrap rounded px-2.5 text-[11px] font-semibold ${approvalEnabled ? 'bg-primary text-white hover:bg-orange-600' : 'cursor-not-allowed border border-border bg-bg text-text-muted'}`}>Approve</button>}</div> : <p className="text-sm font-medium text-text-muted">No plan</p>}</td>
            <td className="px-4 py-3">{item.course ? <><p className="text-sm font-medium text-text">Stage {item.course.currentStep} of {item.course.totalSteps}</p><p className="text-xs capitalize text-text-muted">{item.course.status}</p></> : canManageSchedule ? <button type="button" onClick={() => setExpandedScheduleId((current) => current === item.id ? null : item.id)} aria-expanded={scheduleExpanded} className="text-xs font-semibold text-text underline-offset-4 hover:underline">Set schedule</button> : <span className="text-sm text-text-muted">Not scheduled</span>}</td>
            <td className="px-4 py-3 text-sm text-text-muted">{canEditUpdateTime ? <InlineUpdateTime caseId={item.id} value={item.updateTime} onSaved={reload} onError={setError} /> : formatDate(item.updateTime)}</td>
          </tr>
          {scheduleExpanded && <tr className="border-b border-border bg-bg/40"><td colSpan={6} className="p-4"><WearSchedulePanel course={null} importedTotalSteps={item.importedTotalSteps ?? undefined} canManage caseId={item.id} reload={reload} /></td></tr>}
        </Fragment>
      })}</tbody>
    </table></div>
    <footer className="flex items-center justify-between border-t border-border px-4 py-3"><p className="text-xs text-text-muted">Page {page} of {totalPages}</p><div className="flex gap-1"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="grid h-8 w-8 place-items-center rounded border border-border text-text-muted hover:bg-bg disabled:opacity-40" title="Previous page"><MorphIcon icon={ChevronLeft} hoverIcon={ChevronsLeft} className="h-4 w-4" /></button><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading} className="grid h-8 w-8 place-items-center rounded border border-border text-text-muted hover:bg-bg disabled:opacity-40" title="Next page"><MorphIcon icon={ChevronRight} hoverIcon={ChevronsRight} className="h-4 w-4" /></button></div></footer>
  </div>
}

function PatientAvatar({ name, files }: { name: string; files: CaseRow['fileUrls'] }) {
  const [failed, setFailed] = useState(false)
  const source = files?.['frontal-view']?.[0]?.url
  if (!source || failed) return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-bg text-text-muted"><MorphIcon icon={UserRound} className="h-5 w-5" /></span>
  return <img src={source} alt={`${name} frontal view`} onError={() => setFailed(true)} className="h-10 w-10 shrink-0 rounded-full border border-border object-cover" />
}

function ApprovalDialog({ item, approving, onCancel, onConfirm }: { item: CaseRow; approving: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !approving) onCancel() }}><div role="dialog" aria-modal="true" aria-labelledby="approve-plan-title" className="w-full max-w-md rounded-card border border-border bg-surface p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-50 text-primary"><MorphIcon icon={BadgeCheck} className="h-5 w-5" /></span><div><h2 id="approve-plan-title" className="text-base font-semibold text-text">Approve treatment plan?</h2><p className="mt-2 text-sm leading-6 text-text-muted">By approving Plan V{item.currentPlanVersion} for {item.patientName}, you authorize BrightArk to begin production and acknowledge that production fees will apply.</p></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={approving} onClick={onCancel} className="h-9 rounded border border-border px-3 text-sm font-semibold text-text hover:bg-bg disabled:opacity-50">Cancel</button><button type="button" disabled={approving} onClick={onConfirm} className="h-9 rounded bg-primary px-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">{approving ? 'Approving...' : 'Confirm & Approve'}</button></div></div></div>
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
