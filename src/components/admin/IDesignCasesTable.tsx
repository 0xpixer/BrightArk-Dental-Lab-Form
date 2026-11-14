'use client'

import { Fragment, useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import Link from 'next/link'
import { BadgeCheck, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CirclePlus, Link2, Plus, Save, Search, UserRoundCheck, X } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { usePathname } from 'next/navigation'
import { IDESIGN_PROGRESS_STYLES } from '@/lib/idesign/orders'
import { IDesignNotifications } from '@/components/idesign/IDesignNotifications'
import { WearSchedulePanel } from '@/components/idesign/IDesignCaseDetail'
import { getIDesignPlanApprovalState } from '@/lib/idesign/approval'
import { IDESIGN_VIEW_BUTTON_CLASS, IDesignPlanReviewPanel } from '@/components/idesign/IDesignTreatmentPlans'
import { IDesignPatientAvatar } from '@/components/idesign/IDesignPatientAvatar'

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
  doctorAccountId: number | null
  salesAccountId: number | null
  assignedDoctorName: string | null
  assignedSalesName: string | null
  fileUrls: Record<string, Array<{ url: string; name: string }>> | null
  importedTotalSteps: number | null
}

interface AssignableAccount {
  id: number
  name: string
  role: 'doctor' | 'sales' | 'sales_director'
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
  const [canAssignOrders, setCanAssignOrders] = useState(false)
  const [canCreateCases, setCanCreateCases] = useState(false)
  const [assignableAccounts, setAssignableAccounts] = useState<AssignableAccount[]>([])
  const [canEditUpdateTime, setCanEditUpdateTime] = useState(false)
  const [canManageSchedule, setCanManageSchedule] = useState(false)
  const [expandedScheduleId, setExpandedScheduleId] = useState<number | null>(null)
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null)
  const [assignmentCase, setAssignmentCase] = useState<CaseRow | null>(null)
  const [assigning, setAssigning] = useState(false)
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
      setCanApprovePlans(Boolean(payload.permissions?.canApprovePlans))
      setCanAssignOrders(Boolean(payload.permissions?.canAssignOrders))
      setCanCreateCases(Boolean(payload.permissions?.canCreateCases))
      setAssignableAccounts(payload.options?.assignableAccounts ?? [])
      setCanEditUpdateTime(Boolean(payload.permissions?.canEditUpdateTime))
      setCanManageSchedule(Boolean(payload.permissions?.canManageSchedule))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load clear aligner orders')
    } finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { const timer = setTimeout(load, search ? 250 : 0); return () => clearTimeout(timer) }, [load, search])

  const assignOrder = async (doctorAccountId: number | null, salesAccountId: number | null) => {
    if (!assignmentCase) return
    setAssigning(true)
    setError(null)
    const response = await fetch(`/api/idesign/cases/${assignmentCase.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign_owners', doctorAccountId, salesAccountId }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error || 'Unable to update order access')
    else {
      setAssignmentCase(null)
      await load()
    }
    setAssigning(false)
  }

  return <section className="space-y-4">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-xl font-semibold text-text">iDesign | Clear Aligners</h1><p className="mt-1 text-sm text-text-muted">{loading ? 'Loading orders...' : `${total} clear aligner order${total === 1 ? '' : 's'}`}</p></div><div className="flex items-center gap-2"><IDesignNotifications />{canCreateCases && <Link href={newHref} className="inline-flex h-10 items-center justify-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-orange-600"><MorphIcon icon={Plus} hoverIcon={CirclePlus} className="h-4 w-4" />New Order</Link>}</div></header>
    <div className="rounded-card border border-border bg-surface p-3"><label className="relative block max-w-md"><span className="sr-only">Search clear aligner orders</span><span className="pointer-events-none absolute left-3 top-3"><MorphIcon icon={Search} className="h-4 w-4 text-text-muted" /></span><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search patient or order number" className="h-10 w-full rounded-card border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-text focus:ring-2 focus:ring-text/10" /></label></div>
    {error && <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <CasesTable cases={cases} loading={loading} detailBase={detailBase} canApprovePlans={canApprovePlans} canAssignOrders={canAssignOrders} canEditUpdateTime={canEditUpdateTime} canManageSchedule={canManageSchedule} expandedScheduleId={expandedScheduleId} setExpandedScheduleId={setExpandedScheduleId} expandedPlanId={expandedPlanId} setExpandedPlanId={setExpandedPlanId} setAssignmentCase={setAssignmentCase} reload={load} setError={setError} page={page} totalPages={totalPages} setPage={setPage} />
    {assignmentCase && <AssignmentDialog item={assignmentCase} accounts={assignableAccounts} saving={assigning} onCancel={() => setAssignmentCase(null)} onSave={assignOrder} />}
  </section>
}

function CasesTable({ cases, loading, detailBase, canApprovePlans, canAssignOrders, canEditUpdateTime, canManageSchedule, expandedScheduleId, setExpandedScheduleId, expandedPlanId, setExpandedPlanId, setAssignmentCase, reload, setError, page, totalPages, setPage }: {
  cases: CaseRow[]
  loading: boolean
  detailBase: string
  canApprovePlans: boolean
  canAssignOrders: boolean
  canEditUpdateTime: boolean
  canManageSchedule: boolean
  expandedScheduleId: number | null
  setExpandedScheduleId: Dispatch<SetStateAction<number | null>>
  expandedPlanId: number | null
  setExpandedPlanId: Dispatch<SetStateAction<number | null>>
  setAssignmentCase: Dispatch<SetStateAction<CaseRow | null>>
  reload: () => Promise<void>
  setError: Dispatch<SetStateAction<string | null>>
  page: number
  totalPages: number
  setPage: Dispatch<SetStateAction<number>>
}) {
  const columnCount = canAssignOrders ? 7 : 6
  // Phone cards show only the summary row; one card is open at a time.
  const [openCardId, setOpenCardId] = useState<number | null>(null)
  return <div className="overflow-hidden rounded-card border border-border bg-surface">
    <div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold text-text">Clinical Cases</h2></div>
    <div className="divide-y divide-border md:hidden">{loading ? <p className="px-4 py-10 text-center text-sm text-text-muted">Loading orders...</p> : cases.length === 0 ? <p className="px-4 py-10 text-center text-sm text-text-muted">No clear aligner orders yet</p> : cases.map((item) => {
      const approvalState = getIDesignPlanApprovalState(item.latestProgress, item.currentPlanStatus)
      const planExpanded = expandedPlanId === item.id && Boolean(item.currentPlanVersion)
      const togglePlans = () => setExpandedPlanId((current) => current === item.id ? null : item.id)
      const scheduleExpanded = expandedScheduleId === item.id && !item.course
      const cardOpen = openCardId === item.id
      return <article key={item.id} className={`px-4 ${cardOpen ? 'space-y-3 bg-bg/40 py-4' : 'py-3'}`}>
        <button type="button" onClick={() => setOpenCardId((current) => current === item.id ? null : item.id)} aria-expanded={cardOpen} aria-controls={`case-card-${item.id}`} className="flex w-full items-center gap-3 text-left"><IDesignPatientAvatar name={item.patientName} files={item.fileUrls} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-text">{item.patientName}</p><p className="mt-0.5 truncate text-xs text-text-muted">{item.orderNo}{item.gender ? ` · ${item.gender}` : ''}</p></div><span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${IDESIGN_PROGRESS_STYLES[item.latestProgress] ?? 'border-border bg-bg text-text-muted'}`}>{item.latestProgress}</span><MorphIcon icon={ChevronDown} className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${cardOpen ? 'rotate-180' : ''}`} /></button>
        {cardOpen && <div id={`case-card-${item.id}`} className="space-y-3">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs"><div className="min-w-0"><dt className="text-text-muted">Doctor</dt><dd className="truncate text-sm text-text">{item.doctorName || 'Unassigned'}</dd></div><div className="min-w-0"><dt className="text-text-muted">Update Time</dt><dd className="text-sm text-text">{canEditUpdateTime ? <InlineUpdateTime caseId={item.id} value={item.updateTime} onSaved={reload} onError={setError} /> : formatDate(item.updateTime)}</dd></div><div className="col-span-2 min-w-0"><dt className="text-text-muted">Est. Wear Schedule</dt><dd className="text-sm text-text">{item.course ? <>Stage {item.course.currentStep} of {item.course.totalSteps} <span className="text-xs capitalize text-text-muted">· {item.course.status}</span></> : canManageSchedule ? <button type="button" onClick={() => setExpandedScheduleId((current) => current === item.id ? null : item.id)} aria-expanded={scheduleExpanded} className="inline-flex min-h-11 items-center text-sm font-semibold text-text underline underline-offset-4">Set schedule</button> : <span className="text-text-muted">Not scheduled</span>}</dd></div>{canAssignOrders && <div className="col-span-2 min-w-0"><dt className="text-text-muted">Account Access</dt><dd className="text-xs text-text">Doctor: {item.assignedDoctorName || 'Unassigned'} · Sales: {item.assignedSalesName || 'Unassigned'}<button type="button" onClick={() => setAssignmentCase(item)} className="flex min-h-11 items-center gap-1 text-sm font-semibold text-text underline-offset-4 hover:underline"><MorphIcon icon={Link2} hoverIcon={UserRoundCheck} className="h-3.5 w-3.5" />Manage access</button></dd></div>}</dl>
        <div className="flex flex-wrap items-center gap-2">{item.currentPlanVersion ? approvalState.approved
          ? <button type="button" onClick={togglePlans} aria-expanded={planExpanded} aria-label={`View approved treatment plans for ${item.patientName}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-text-muted hover:text-text">Plan approved<MorphIcon icon={ChevronDown} className={`h-3 w-3 transition-transform ${planExpanded ? 'rotate-180' : ''}`} /></button>
          : <><button type="button" onClick={togglePlans} aria-expanded={planExpanded} aria-label={`View & Approve treatment plans for ${item.patientName}`} className={IDESIGN_VIEW_BUTTON_CLASS}>View &amp; Approve<MorphIcon icon={ChevronDown} className={`h-3 w-3 transition-transform ${planExpanded ? 'rotate-180' : ''}`} /></button><span className="text-xs font-medium text-text-muted">Latest V{item.currentPlanVersion}</span></>
          : <p className="text-sm font-medium text-text-muted">No plan</p>}<Link href={`${detailBase}/${item.id}`} className="ml-auto inline-flex min-h-11 items-center text-sm font-semibold text-text underline-offset-4 hover:underline">Details</Link></div>
        {planExpanded && <div className="-mx-4 border-t border-border bg-bg/40 px-2 py-3"><IDesignPlanReviewPanel caseId={item.id} onApproved={reload} /></div>}
        {scheduleExpanded && <div className="-mx-4 border-t border-border bg-bg/40 px-2 py-3"><WearSchedulePanel course={null} importedTotalSteps={item.importedTotalSteps ?? undefined} canManage caseId={item.id} reload={reload} /></div>}
        </div>}
      </article>
    })}</div>
    <div className="hidden overflow-x-auto md:block"><table className={`w-full ${canAssignOrders ? 'min-w-[1120px]' : 'min-w-[940px]'}`}>
      <thead className="border-b border-border bg-bg text-left text-xs font-semibold uppercase text-text-muted"><tr><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Doctor</th>{canAssignOrders && <th className="px-4 py-3">Account Access</th>}<th className="px-4 py-3">Status</th><th className="px-4 py-3">Treatment Plan</th><th className="px-4 py-3">Est. Wear Schedule</th><th className="px-4 py-3">Update Time</th></tr></thead>
      <tbody>{loading ? <tr><td colSpan={columnCount} className="px-4 py-10 text-center text-sm text-text-muted">Loading orders...</td></tr> : cases.length === 0 ? <tr><td colSpan={columnCount} className="px-4 py-10 text-center text-sm text-text-muted">No clear aligner orders yet</td></tr> : cases.map((item) => {
        const approvalState = getIDesignPlanApprovalState(item.latestProgress, item.currentPlanStatus)
        const planExpanded = expandedPlanId === item.id && Boolean(item.currentPlanVersion)
        const togglePlans = () => setExpandedPlanId((current) => current === item.id ? null : item.id)
        const scheduleExpanded = expandedScheduleId === item.id && !item.course
        return <Fragment key={item.id}>
          <tr className="border-b border-border hover:bg-bg/60">
            <td className="px-4 py-3"><div className="flex items-center gap-3"><IDesignPatientAvatar name={item.patientName} files={item.fileUrls} /><div className="min-w-0"><Link href={`${detailBase}/${item.id}`} className="block truncate text-sm font-semibold text-text underline-offset-4 hover:underline">{item.patientName}</Link><p className="mt-0.5 truncate text-xs text-text-muted">{item.orderNo}{item.gender ? ` · ${item.gender}` : ''}</p></div></div></td>
            <td className="px-4 py-3 text-sm text-text">{item.doctorName || 'Unassigned'}</td>
            {canAssignOrders && <td className="px-4 py-3"><p className="whitespace-nowrap text-xs text-text"><span className="text-text-muted">Doctor:</span> {item.assignedDoctorName || 'Unassigned'}</p><p className="mt-1 whitespace-nowrap text-xs text-text"><span className="text-text-muted">Sales:</span> {item.assignedSalesName || 'Unassigned'}</p><button type="button" onClick={() => setAssignmentCase(item)} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-text underline-offset-4 hover:underline"><MorphIcon icon={Link2} hoverIcon={UserRoundCheck} className="h-3.5 w-3.5" />Manage access</button></td>}
            <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${IDESIGN_PROGRESS_STYLES[item.latestProgress] ?? 'border-border bg-bg text-text-muted'}`}>{item.latestProgress}</span></td>
            <td className="px-4 py-3">{item.currentPlanVersion ? approvalState.approved
              ? <button type="button" onClick={togglePlans} aria-expanded={planExpanded} aria-label={`View approved treatment plans for ${item.patientName}`} className="inline-flex items-center gap-1 px-0.5 text-xs font-medium text-text-muted hover:text-text">Approved<MorphIcon icon={ChevronDown} className={`h-3 w-3 transition-transform ${planExpanded ? 'rotate-180' : ''}`} /></button>
              : <div className="flex w-fit flex-col items-start gap-1.5"><button type="button" onClick={togglePlans} aria-expanded={planExpanded} aria-label={`View & Approve treatment plans for ${item.patientName}`} className={IDESIGN_VIEW_BUTTON_CLASS}>View &amp; Approve<MorphIcon icon={ChevronDown} className={`h-3 w-3 transition-transform ${planExpanded ? 'rotate-180' : ''}`} /></button><span className="px-0.5 text-xs font-medium text-text-muted">Latest V{item.currentPlanVersion}</span></div>
              : <p className="text-sm font-medium text-text-muted">No plan</p>}</td>
            <td className="px-4 py-3">{item.course ? <><p className="text-sm font-medium text-text">Stage {item.course.currentStep} of {item.course.totalSteps}</p><p className="text-xs capitalize text-text-muted">{item.course.status}</p></> : canManageSchedule ? <button type="button" onClick={() => setExpandedScheduleId((current) => current === item.id ? null : item.id)} aria-expanded={scheduleExpanded} className="text-xs font-semibold text-text underline-offset-4 hover:underline">Set schedule</button> : <span className="text-sm text-text-muted">Not scheduled</span>}</td>
            <td className="px-4 py-3 text-sm text-text-muted">{canEditUpdateTime ? <InlineUpdateTime caseId={item.id} value={item.updateTime} onSaved={reload} onError={setError} /> : formatDate(item.updateTime)}</td>
          </tr>
          {planExpanded && <tr className="border-b border-border bg-bg/40"><td colSpan={columnCount} className="p-4"><IDesignPlanReviewPanel caseId={item.id} onApproved={reload} /></td></tr>}
          {scheduleExpanded && <tr className="border-b border-border bg-bg/40"><td colSpan={columnCount} className="p-4"><WearSchedulePanel course={null} importedTotalSteps={item.importedTotalSteps ?? undefined} canManage caseId={item.id} reload={reload} /></td></tr>}
        </Fragment>
      })}</tbody>
    </table></div>
    <footer className="flex items-center justify-between border-t border-border px-4 py-3"><p className="text-xs text-text-muted">Page {page} of {totalPages}</p><div className="flex gap-1"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="grid h-11 w-11 place-items-center rounded border border-border text-text-muted hover:bg-bg disabled:opacity-40 md:h-8 md:w-8" title="Previous page"><MorphIcon icon={ChevronLeft} hoverIcon={ChevronsLeft} className="h-4 w-4" /></button><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading} className="grid h-11 w-11 place-items-center rounded border border-border text-text-muted hover:bg-bg disabled:opacity-40 md:h-8 md:w-8" title="Next page"><MorphIcon icon={ChevronRight} hoverIcon={ChevronsRight} className="h-4 w-4" /></button></div></footer>
  </div>
}

function AssignmentDialog({ item, accounts, saving, onCancel, onSave }: { item: CaseRow; accounts: AssignableAccount[]; saving: boolean; onCancel: () => void; onSave: (doctorAccountId: number | null, salesAccountId: number | null) => Promise<void> }) {
  const [doctorAccountId, setDoctorAccountId] = useState(item.doctorAccountId ? String(item.doctorAccountId) : '')
  const [salesAccountId, setSalesAccountId] = useState(item.salesAccountId ? String(item.salesAccountId) : '')
  const doctors = accounts.filter((account) => account.role === 'doctor')
  const salespeople = accounts.filter((account) => account.role === 'sales' || account.role === 'sales_director')
  const selectedId = (value: string) => value ? Number(value) : null

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onCancel() }}>
    <div role="dialog" aria-modal="true" aria-labelledby="assign-order-title" className="w-full max-w-lg rounded-card border border-border bg-surface">
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4"><div><h2 id="assign-order-title" className="text-base font-semibold text-text">Manage order access</h2><p className="mt-1 text-sm text-text-muted">{item.patientName} · {item.orderNo}</p></div><button type="button" title="Close" disabled={saving} onClick={onCancel} className="grid h-8 w-8 shrink-0 place-items-center rounded text-text-muted hover:bg-bg hover:text-text disabled:opacity-40"><MorphIcon icon={X} className="h-4 w-4" /></button></header>
      <div className="space-y-4 p-5">
        <label><span className="mb-1.5 block text-xs font-semibold text-text">Doctor account</span><select value={doctorAccountId} onChange={(event) => setDoctorAccountId(event.target.value)} className="h-10 w-full rounded-card border border-border bg-surface px-3 text-sm text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10"><option value="">Unassigned</option>{doctors.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><span className="mt-1.5 block text-xs text-text-muted">The selected doctor and their linked Clinic Staff can view this order.</span></label>
        <label><span className="mb-1.5 block text-xs font-semibold text-text">Sales account</span><select value={salesAccountId} onChange={(event) => setSalesAccountId(event.target.value)} className="h-10 w-full rounded-card border border-border bg-surface px-3 text-sm text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10"><option value="">Unassigned</option>{salespeople.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><span className="mt-1.5 block text-xs text-text-muted">The selected Sales account can view this order in their dashboard.</span></label>
      </div>
      <footer className="flex justify-end gap-2 border-t border-border px-5 py-4"><button type="button" disabled={saving} onClick={onCancel} className="h-9 rounded border border-border px-3 text-sm font-semibold text-text hover:bg-bg disabled:opacity-40">Cancel</button><button type="button" disabled={saving} onClick={() => void onSave(selectedId(doctorAccountId), selectedId(salesAccountId))} className="inline-flex h-9 items-center gap-2 rounded bg-text px-3 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"><MorphIcon icon={Save} hoverIcon={BadgeCheck} className="h-4 w-4" />{saving ? 'Saving...' : 'Save access'}</button></footer>
    </div>
  </div>
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
