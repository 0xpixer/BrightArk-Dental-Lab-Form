'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, CirclePause, ExternalLink, MoveLeft, Play, Plus, Save, Trash2, X } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { IDesignNotifications } from './IDesignNotifications'
import { IDESIGN_PROGRESS_OPTIONS, IDESIGN_PROGRESS_STYLES } from '@/lib/idesign/orders'
import type { IDesignCaseInformationData } from '@/components/admin/NewIDesignOrderForm'
import { IDesignPatientAvatar } from './IDesignPatientAvatar'
import { getIDesignPlanApprovalState } from '@/lib/idesign/approval'

const IDesignCaseInformationEditor = dynamic(
  () => import('@/components/admin/NewIDesignOrderForm').then((module) => module.IDesignCaseInformationEditor),
  { loading: () => <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-text-muted">Loading case information...</div> },
)

const IDesignCaseInformationViewer = dynamic(
  () => import('@/components/admin/NewIDesignOrderForm').then((module) => module.IDesignCaseInformationViewer),
  { loading: () => <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-text-muted">Loading case information...</div> },
)

interface PlanRow { id: number; versionNumber: number; summary: string | null; status: string; editableUrl: string | null; publishedAt: string; approvedAt: string | null; createdByName: string | null; approvedByName: string | null }
interface StepRow { id: number; stepNumber: number; durationDays: number; suggestedStartDate: string; suggestedEndDate: string; actualStartDate: string | null; status: string }
interface CourseRow { id: number; startDate: string; totalSteps: number; defaultDurationDays: number; currentStep: number; originalEstimatedFinish: string; currentEstimatedFinish: string; nextSuggestedChange: string | null; status: string; steps: StepRow[] }
interface DetailPayload {
  case: Record<string, any> & IDesignCaseInformationData & { id: number; orderNo: string; latestProgress: string; planReviewStatus: string; currentEditableUrl: string | null; doctorName: string | null; clinicName: string | null; salesName: string | null }
  importedOrder: null | Record<string, any>
  plans: PlanRow[]
  activities: Array<{ id: number; detail: string; actorName: string; createdAt: string }>
  course: CourseRow | null
  permissions: { canManagePlans: boolean; canUpdateStatus: boolean; canApprovePlans: boolean; canManageSchedule: boolean; canViewEditablePlan: boolean; canViewCommercial: boolean; canEditCaseInformation: boolean; canDownloadCaseFiles: boolean; canDeleteCase: boolean; showSales: boolean }
}

type DetailTab = 'case-information' | 'treatment-progress'

export function IDesignCaseDetail({ caseId }: { caseId: number }) {
  const pathname = usePathname()
  const router = useRouter()
  const portal = pathname.startsWith('/portal')
  const listHref = portal ? '/portal/idesign/orders' : '/admin/idesign/orders'
  const [data, setData] = useState<DetailPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DetailTab>('treatment-progress')
  const [planAttention, setPlanAttention] = useState(0)
  const [highlightPlan, setHighlightPlan] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const response = await fetch(`/api/idesign/cases/${caseId}`, { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error ?? 'Unable to load case')
    else { setData(payload); setError(null) }
    setLoading(false)
  }, [caseId])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!planAttention || activeTab !== 'treatment-progress') return
    setHighlightPlan(true)
    const frame = window.requestAnimationFrame(() => document.getElementById('treatment-plan-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
    const timeout = window.setTimeout(() => setHighlightPlan(false), 3200)
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timeout) }
  }, [activeTab, planAttention])

  const reviewTreatmentPlan = () => {
    setActiveTab('treatment-progress')
    setPlanAttention((value) => value + 1)
  }
  const deleteCase = async () => {
    setDeleting(true)
    setDeleteError(null)
    const response = await fetch(`/api/idesign/cases/${caseId}`, { method: 'DELETE' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setDeleteError(payload.error ?? 'Unable to delete this order')
      setDeleting(false)
      return
    }
    router.replace(listHref)
    router.refresh()
  }
  if (loading && !data) return <div className="py-20 text-center text-sm text-text-muted">Loading case...</div>
  if (!data) return <div className="rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error ?? 'Case not found'}</div>

  return <div className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><Link href={listHref} className="grid h-9 w-9 place-items-center rounded-card border border-border bg-surface text-text-muted hover:bg-bg hover:text-text" title="Back to orders"><MorphIcon icon={ArrowLeft} hoverIcon={MoveLeft} className="h-4 w-4" /></Link><IDesignPatientAvatar name={data.case.patientName} files={data.case.fileUrls} /><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold text-text">{data.case.patientName}</h1>{data.permissions.canUpdateStatus ? <StatusSelect caseId={caseId} value={data.case.latestProgress} reload={load} /> : <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${IDESIGN_PROGRESS_STYLES[data.case.latestProgress] ?? 'border-border bg-bg text-text-muted'}`}>{data.case.latestProgress}</span>}</div><p className="mt-1 text-sm text-text-muted">{formatPatientDemographics(data.case.gender, data.case.dateOfBirth)}</p></div></div>
      <div className="flex items-center gap-2">{data.permissions.canDeleteCase && <button type="button" onClick={() => { setDeleteError(null); setDeleteOpen(true) }} className="inline-flex h-9 items-center gap-2 rounded-card border border-red-200 bg-surface px-3 text-xs font-semibold text-red-600 hover:bg-red-50"><MorphIcon icon={Trash2} className="h-4 w-4" />Delete Order</button>}<IDesignNotifications /></div>
    </header>
    {error && <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

    <section className={`grid gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-2 ${data.permissions.showSales ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
      <Summary label="Doctor" value={data.case.doctorName || 'Unassigned'} />
      <Summary label="Clinic" value={data.case.clinicName || 'Unassigned'} />
      {data.permissions.showSales && <Summary label="Sales" value={data.case.salesName || 'Unassigned'} />}
      <Summary label="Est. wear schedule" value={data.course ? `Stage ${data.course.currentStep} of ${data.course.totalSteps}` : 'Not scheduled'} />
      <StatusSummary value={data.case.latestProgress} onReview={reviewTreatmentPlan} />
    </section>

    <DetailTabs activeTab={activeTab} onChange={setActiveTab} />

    <div id="treatment-progress-panel" role="tabpanel" aria-labelledby="treatment-progress-tab" hidden={activeTab !== 'treatment-progress'}>
      {activeTab === 'treatment-progress' && <div className="space-y-6">
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <div id="treatment-plan-section" className={`scroll-mt-6 rounded-card ${highlightPlan ? 'plan-attention-flash' : ''}`}><TreatmentPlanPanel data={data} caseId={caseId} reload={load} /></div>
          <WearSchedulePanel course={data.course} importedTotalSteps={Number(data.importedOrder?.totalSteps) || undefined} canManage={data.permissions.canManageSchedule} caseId={caseId} reload={load} />
        </div>
        <ActivityPanel activities={data.activities} />
      </div>
      }
    </div>

    <div id="case-information-panel" role="tabpanel" aria-labelledby="case-information-tab" hidden={activeTab !== 'case-information'}>
      {activeTab === 'case-information' && (data.permissions.canEditCaseInformation
        ? <IDesignCaseInformationEditor caseId={caseId} value={data.case} onSaved={load} downloadUrl={data.permissions.canDownloadCaseFiles ? `/api/idesign/cases/${caseId}/files/download` : undefined} hideHeader />
        : <IDesignCaseInformationViewer caseId={caseId} value={data.case} downloadUrl={data.permissions.canDownloadCaseFiles ? `/api/idesign/cases/${caseId}/files/download` : undefined} hideHeader />)}
    </div>

    {deleteOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteOpen(false) }}><div role="dialog" aria-modal="true" aria-labelledby="delete-order-title" className="w-full max-w-md rounded-card border border-border bg-surface p-5"><div className="flex items-start justify-between gap-4"><div><h2 id="delete-order-title" className="text-base font-semibold text-text">Delete this order?</h2><p className="mt-2 text-sm leading-6 text-text-muted">This permanently deletes <span className="font-medium text-text">{data.case.patientName}</span> ({data.case.orderNo}) and all related treatment plans, schedule records and activity. This action cannot be undone.</p></div><button type="button" disabled={deleting} onClick={() => setDeleteOpen(false)} className="grid h-8 w-8 shrink-0 place-items-center rounded-card text-text-muted hover:bg-bg hover:text-text disabled:opacity-40" aria-label="Close delete confirmation"><MorphIcon icon={X} className="h-4 w-4" /></button></div>{deleteError && <p role="alert" className="mt-3 rounded-card bg-red-50 px-3 py-2 text-sm text-red-700">{deleteError}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={deleting} onClick={() => setDeleteOpen(false)} className="h-9 rounded-card border border-border px-4 text-sm font-semibold text-text hover:bg-bg disabled:opacity-40">Cancel</button><button type="button" disabled={deleting} onClick={() => void deleteCase()} className="inline-flex h-9 items-center gap-2 rounded-card bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"><MorphIcon icon={Trash2} className="h-4 w-4" />{deleting ? 'Deleting...' : 'Delete Order'}</button></div></div></div>}
  </div>
}

function DetailTabs({ activeTab, onChange }: { activeTab: DetailTab; onChange: (tab: DetailTab) => void }) {
  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: 'treatment-progress', label: 'Treatment & Progress' },
    { id: 'case-information', label: 'Case Information' },
  ]

  return <div role="tablist" aria-label="Patient case details" className="grid overflow-hidden rounded-card border border-primary bg-surface sm:inline-grid sm:grid-cols-2">
    {tabs.map((tab) => {
      const active = activeTab === tab.id
      return <button key={tab.id} id={`${tab.id}-tab`} type="button" role="tab" aria-selected={active} aria-controls={`${tab.id}-panel`} tabIndex={active ? 0 : -1} onClick={() => onChange(tab.id)} className={`min-h-11 px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${active ? 'bg-primary text-white' : 'bg-surface text-primary hover:bg-orange-50'}`}>{tab.label}</button>
    })}
  </div>
}

function TreatmentPlanPanel({ data, caseId, reload }: { data: DetailPayload; caseId: number; reload: () => Promise<void> }) {
  const [editableUrl, setEditableUrl] = useState(data.case.currentEditableUrl ?? '')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latest = data.plans[0]
  const approvedPlan = data.plans.find((plan) => plan.status === 'approved')
  const implicitApproval = Boolean(latest && !approvedPlan && getIDesignPlanApprovalState(data.case.latestProgress, latest.status).approved)
  const featuredPlan = approvedPlan ?? latest
  const approvalLocked = Boolean(approvedPlan) || implicitApproval
  const otherPlans = data.plans.filter((plan) => plan.id !== featuredPlan?.id)

  const publish = async () => {
    setBusy(true); setError(null)
    const response = await fetch(`/api/idesign/cases/${caseId}/plans`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ editableUrl, summary }) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error ?? 'Unable to publish plan')
    else { setSummary(''); await reload() }
    setBusy(false)
  }
  const action = async (name: 'approve' | 'update_editable', planId?: number) => {
    setBusy(true); setError(null)
    const body = name === 'update_editable' ? { action: name, editableUrl } : { action: name, planId }
    const response = await fetch(`/api/idesign/cases/${caseId}/plans`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error ?? 'Unable to update review')
    else await reload()
    setBusy(false)
  }

  const planActions = (plan: PlanRow) => {
    const canView = data.permissions.canViewEditablePlan && Boolean(plan.editableUrl || data.case.currentEditableUrl)
    const isApprovedPlan = plan.id === approvedPlan?.id || (implicitApproval && plan.id === latest?.id)
    const readyForApproval = getIDesignPlanApprovalState(data.case.latestProgress, plan.status).readyForApproval
    return <div className="flex shrink-0 items-center gap-2">
      {canView ? <a href={`/api/idesign/cases/${caseId}/open?planId=${plan.id}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-card border border-border bg-surface px-2.5 text-[11px] font-semibold text-text hover:bg-neutral-100"><MorphIcon icon={ExternalLink} className="h-3 w-3" />View Plan</a> : <span className="inline-flex h-8 items-center rounded-card border border-border bg-neutral-100 px-2.5 text-[11px] font-semibold text-text-muted">No Link</span>}
      <button type="button" disabled={busy || approvalLocked || !data.permissions.canApprovePlans || !readyForApproval} onClick={() => void action('approve', plan.id)} className={`inline-flex h-8 items-center justify-center rounded-card px-2.5 text-[11px] font-semibold ${isApprovedPlan ? 'bg-neutral-100 text-text-muted' : 'bg-primary text-white hover:bg-orange-600 disabled:bg-neutral-100 disabled:text-text-muted'}`}>{isApprovedPlan ? 'Approved' : 'Approve'}</button>
    </div>
  }

  return <section className="overflow-hidden rounded-card border border-border bg-surface">
    <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className="h-4 w-1 shrink-0 rounded-full bg-primary" aria-hidden /><h2 className="text-sm font-semibold text-text">Treatment Plan</h2></div><p className="mt-1 text-xs text-text-muted">Review and approve a clinical design.</p></div>{featuredPlan && <span className="w-fit rounded bg-bg px-2 py-1 text-xs font-semibold text-text">{approvedPlan || implicitApproval ? 'Approved' : 'Latest'}: V{featuredPlan.versionNumber}</span>}</div>
    <div className="space-y-4 p-4">
      {!featuredPlan ? <div className="rounded-card border border-dashed border-border py-10 text-center"><p className="text-sm font-medium text-text">No treatment plan published</p><p className="mt-1 text-xs text-text-muted">The plan will appear here when it is ready for review.</p></div> : <div className="flex flex-col gap-3 rounded-card border border-border bg-bg p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-text">Treatment Plan V{featuredPlan.versionNumber}</p><span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium capitalize text-text-muted">{featuredPlan.status}</span></div><p className="mt-1 text-xs text-text-muted">Published {formatDate(featuredPlan.publishedAt)}{featuredPlan.summary ? ` · ${featuredPlan.summary}` : ''}</p></div>{planActions(featuredPlan)}</div>}

      {data.permissions.canManagePlans && <details className="rounded-card border border-border"><summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-text">Publish a new plan version</summary><div className="space-y-3 border-t border-border p-4"><Field label="Editable link"><input type="url" value={editableUrl} onChange={(event) => setEditableUrl(event.target.value)} placeholder="https://..." className={inputClass} /></Field><label><span className="mb-1 block text-xs font-medium text-text-muted">Version summary</span><input value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={500} placeholder="Optional internal summary" className={inputClass} /></label><button type="button" disabled={busy || !editableUrl} onClick={() => void publish()} className="inline-flex h-10 items-center gap-2 rounded-card bg-text px-4 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-40"><MorphIcon icon={Plus} hoverIcon={Save} className="h-4 w-4" />{busy ? 'Publishing...' : `Publish V${(latest?.versionNumber ?? 0) + 1}`}</button></div></details>}
      {data.permissions.canManagePlans && latest && <details className="rounded-card border border-border"><summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-text">Manage current plan editor link</summary><div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-end"><Field label="Editable link"><input type="url" value={editableUrl} onChange={(event) => setEditableUrl(event.target.value)} placeholder="https://..." className={inputClass} /></Field><button type="button" disabled={busy || !editableUrl} onClick={() => void action('update_editable')} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-card bg-text px-4 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-40"><MorphIcon icon={Save} className="h-4 w-4" />Save Editor Link</button></div></details>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {otherPlans.length > 0 && <details><summary className="cursor-pointer text-xs font-semibold text-text-muted">View {otherPlans.length} other version{otherPlans.length === 1 ? '' : 's'}</summary><div className="mt-3 divide-y divide-border rounded-card border border-border">{otherPlans.map((plan) => <div key={plan.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-text">V{plan.versionNumber}</p><p className="text-xs capitalize text-text-muted">{formatDate(plan.publishedAt)} · {plan.status}</p></div>{planActions(plan)}</div>)}</div></details>}
    </div>
  </section>
}

export function WearSchedulePanel({ course, importedTotalSteps, canManage, caseId, reload }: { course: CourseRow | null; importedTotalSteps?: number; canManage: boolean; caseId: number; reload: () => Promise<void> }) {
  const today = localDateValue(new Date())
  const [startDate, setStartDate] = useState(today)
  const [totalSteps, setTotalSteps] = useState(Math.max(1, importedTotalSteps ?? 10))
  const [durationDays, setDurationDays] = useState(10)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (course) {
      setStartDate(course.startDate)
      setTotalSteps(course.totalSteps)
      setDurationDays(course.defaultDurationDays)
    }
  }, [course])
  const resize = (count: number) => setTotalSteps(Math.min(100, Math.max(1, count)))
  const request = async (method: 'POST' | 'PATCH', body: Record<string, unknown>) => {
    setBusy(true)
    setError(null)
    const response = await fetch(`/api/idesign/cases/${caseId}/schedule`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error ?? 'Unable to update schedule')
    else await reload()
    setBusy(false)
  }

  return <section className="overflow-hidden rounded-card border border-border bg-surface">
    <div className="border-b border-border px-4 py-4"><div className="flex items-center gap-2"><span className="h-4 w-1 shrink-0 rounded-full bg-primary" aria-hidden /><h2 className="text-sm font-semibold text-text">Patient Wear Schedule</h2></div><p className="mt-1 text-xs text-text-muted">The current stage is calculated automatically from the wear schedule.</p></div>
    <div className="space-y-4 p-4">
      {!course ? canManage ? <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="First wear date"><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} /></Field>
          <Field label="Total stages"><input type="number" min={1} max={100} value={totalSteps} onChange={(event) => resize(Number(event.target.value))} className={inputClass} /></Field>
          <Field label="Duration per stage"><div className="grid grid-cols-3 gap-1">{[{ label: '7 days', value: 7 }, { label: '10 days', value: 10 }, { label: '2 weeks', value: 14 }].map((option) => <button key={option.value} type="button" onClick={() => setDurationDays(option.value)} className={`h-10 rounded-card border text-xs font-medium ${durationDays === option.value ? 'border-text bg-text text-white' : 'border-border hover:bg-bg'}`}>{option.label}</button>)}</div></Field>
        </div>
        <button type="button" disabled={busy} onClick={() => void request('POST', { startDate, totalSteps, defaultDurationDays: durationDays, durations: Array.from({ length: totalSteps }, () => durationDays), timezone: 'Asia/Jakarta' })} className="inline-flex h-10 items-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"><MorphIcon icon={Play} className="h-4 w-4" />Start Wear Schedule</button>
      </div> : <p className="py-8 text-center text-sm text-text-muted">An authorized user can start the wear schedule.</p> : <>
        <div className="grid gap-3 sm:grid-cols-4"><Summary label="Progress" value={`Stage ${course.currentStep} of ${course.totalSteps}`} valueClassName="text-primary" /><Summary label="Next suggested change" value={formatDate(course.nextSuggestedChange)} /><Summary label="Estimated finish" value={formatDate(course.currentEstimatedFinish)} /><Summary label="Schedule status" value={titleCase(course.status)} /></div>
        <div className="h-2 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full bg-text transition-[width]" style={{ width: `${Math.min(100, course.currentStep / course.totalSteps * 100)}%` }} /></div>
        {canManage && <div className="flex flex-wrap gap-2">{course.status === 'paused' ? <button type="button" disabled={busy} onClick={() => void request('PATCH', { action: 'resume', actualDate: today })} className="inline-flex h-9 items-center gap-2 rounded-card border border-border px-3 text-xs font-semibold hover:bg-bg"><MorphIcon icon={Play} className="h-3.5 w-3.5" />Resume</button> : course.status !== 'completed' && <button type="button" disabled={busy} onClick={() => void request('PATCH', { action: 'pause' })} className="inline-flex h-9 items-center gap-2 rounded-card border border-border px-3 text-xs font-semibold hover:bg-bg"><MorphIcon icon={CirclePause} className="h-3.5 w-3.5" />Pause</button>}</div>}
        {canManage && <details className="rounded-card border border-border"><summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold text-text">Edit wear schedule</summary><div className="space-y-3 border-t border-border p-3"><div className="grid gap-3 sm:grid-cols-3"><Field label="First wear date"><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} /></Field><Field label="Total stages"><input type="number" min={1} max={100} value={totalSteps} onChange={(event) => resize(Number(event.target.value))} className={inputClass} /></Field><Field label="Duration per stage"><div className="grid grid-cols-3 gap-1">{[{ label: '7 days', value: 7 }, { label: '10 days', value: 10 }, { label: '2 weeks', value: 14 }].map((option) => <button key={option.value} type="button" onClick={() => setDurationDays(option.value)} className={`h-10 rounded-card border text-xs font-medium ${durationDays === option.value ? 'border-text bg-text text-white' : 'border-border hover:bg-bg'}`}>{option.label}</button>)}</div></Field></div><button type="button" disabled={busy} onClick={() => void request('PATCH', { action: 'reset', startDate, totalSteps, defaultDurationDays: durationDays, durations: Array.from({ length: totalSteps }, () => durationDays), timezone: 'Asia/Jakarta' })} className="inline-flex h-9 items-center gap-2 rounded-card bg-text px-3 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"><MorphIcon icon={Save} className="h-3.5 w-3.5" />Save Schedule</button></div></details>}
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="border-b border-border text-xs uppercase text-text-muted"><tr><th className="px-3 py-2">Stage</th><th className="px-3 py-2">Duration</th><th className="px-3 py-2">Suggested start</th><th className="px-3 py-2">Suggested end</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{course.steps.map((step) => {
          const current = step.status === 'current'
          return <tr key={step.id} className={`border-b last:border-0 ${current ? 'border-neutral-700 bg-text text-white' : 'border-border'}`}><td className="px-3 py-2 text-sm font-medium">{step.stepNumber}</td><td className="px-3 py-2 text-sm">{step.durationDays} days</td><td className={`px-3 py-2 text-sm ${current ? 'text-white' : 'text-text-muted'}`}>{formatDate(step.actualStartDate || step.suggestedStartDate)}</td><td className={`px-3 py-2 text-sm ${current ? 'text-white' : 'text-text-muted'}`}>{formatDate(step.suggestedEndDate)}</td><td className={`px-3 py-2 text-xs font-medium capitalize ${current ? 'text-white' : 'text-text-muted'}`}>{step.status}</td></tr>
        })}</tbody></table></div>
      </>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  </section>
}

function StatusSelect({ caseId, value, reload }: { caseId: number; value: string; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const update = async (latestProgress: string) => {
    setBusy(true)
    const response = await fetch(`/api/idesign/cases/${caseId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latestProgress }) })
    if (response.ok) await reload()
    setBusy(false)
  }
  return <select aria-label="Order status" disabled={busy} value={value} onChange={(event) => void update(event.target.value)} className={`h-8 rounded-full border px-2.5 text-xs font-medium outline-none ${IDESIGN_PROGRESS_STYLES[value] ?? 'border-border bg-bg text-text-muted'}`}>{IDESIGN_PROGRESS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
}

function ActivityPanel({ activities }: { activities: DetailPayload['activities'] }) {
  return <section className="border-t border-border pt-5"><div className="px-1"><h2 className="text-sm font-semibold text-text">Activity</h2><p className="mt-1 text-xs text-text-muted">Plan, approval and schedule history</p></div><ol className="mt-2 max-h-[420px] overflow-y-auto px-1">{activities.length === 0 ? <li className="py-8 text-sm text-text-muted">No activity yet</li> : activities.map((activity) => <li key={activity.id} className="relative border-l border-border py-3 pl-4 before:absolute before:-left-1 before:top-5 before:h-2 before:w-2 before:rounded-full before:bg-text"><p className="text-sm text-text">{activity.detail}</p><p className="mt-1 text-[10px] text-text-muted">{formatDate(activity.createdAt)} · {activity.actorName}</p></li>)}</ol></section>
}

function Summary({ label, value, valueClassName = 'text-text' }: { label: string; value: string; valueClassName?: string }) { return <div className="bg-surface px-4 py-3"><p className="text-[10px] font-semibold uppercase text-text-muted">{label}</p><p className={`mt-1 truncate text-sm font-medium ${valueClassName}`}>{value}</p></div> }
function StatusSummary({ value, onReview }: { value: string; onReview: () => void }) { return <div className="bg-surface px-4 py-3"><p className="text-[10px] font-semibold uppercase text-text-muted">Status</p><div className="mt-1 flex flex-wrap items-center gap-2"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${IDESIGN_PROGRESS_STYLES[value] ?? 'border-border bg-bg text-text-muted'}`}>{value}</span>{value === 'Awaiting Approval' && <button type="button" onClick={onReview} className="inline-flex h-7 items-center rounded-card border border-primary px-2.5 text-[11px] font-semibold text-primary hover:bg-orange-50">Review &amp; Approval</button>}</div></div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-1 block text-xs font-medium text-text-muted">{label}</span>{children}</label> }
function titleCase(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function formatDate(value: string | null | undefined) { if (!value) return '—'; const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) }
function formatPatientDemographics(gender: string | null | undefined, dateOfBirth: string | null | undefined) { const age = patientAge(dateOfBirth); return [gender || null, age === null ? null : `${age} yrs`].filter(Boolean).join(' | ') || 'Demographics not specified' }
function patientAge(dateOfBirth: string | null | undefined) { if (!dateOfBirth) return null; const birth = new Date(`${dateOfBirth.slice(0, 10)}T00:00:00Z`); if (Number.isNaN(birth.getTime())) return null; const today = new Date(); let age = today.getUTCFullYear() - birth.getUTCFullYear(); const beforeBirthday = today.getUTCMonth() < birth.getUTCMonth() || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate()); if (beforeBirthday) age -= 1; return age >= 0 ? age : null }
function localDateValue(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` }
const inputClass = 'h-10 w-full rounded-card border border-border bg-surface px-3 text-sm text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10'
