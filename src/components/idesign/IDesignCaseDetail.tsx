'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, BadgeCheck, Check, CirclePause, ExternalLink, MoveLeft, Play, Plus, RefreshCcw, Save } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { IDesignNotifications } from './IDesignNotifications'
import { IDESIGN_PROGRESS_OPTIONS, IDESIGN_PROGRESS_STYLES } from '@/lib/idesign/orders'

interface PlanRow { id: number; versionNumber: number; summary: string | null; status: string; publishedAt: string; approvedAt: string | null; createdByName: string | null; approvedByName: string | null }
interface StepRow { id: number; stepNumber: number; durationDays: number; suggestedStartDate: string; suggestedEndDate: string; actualStartDate: string | null; status: string }
interface CourseRow { id: number; startDate: string; totalSteps: number; defaultDurationDays: number; currentStep: number; originalEstimatedFinish: string; currentEstimatedFinish: string; nextSuggestedChange: string | null; status: string; steps: StepRow[] }
interface DetailPayload {
  case: Record<string, any> & { id: number; orderNo: string; patientName: string; latestProgress: string; planReviewStatus: string; currentEditableUrl: string | null; doctorName: string | null; salesName: string | null }
  importedOrder: null | Record<string, any>
  plans: PlanRow[]
  activities: Array<{ id: number; detail: string; actorName: string; createdAt: string }>
  course: CourseRow | null
  permissions: { canManagePlans: boolean; canApprovePlans: boolean; canManageSchedule: boolean; canViewEditablePlan: boolean; canViewCommercial: boolean }
}

export function IDesignCaseDetail({ caseId }: { caseId: number }) {
  const pathname = usePathname()
  const portal = pathname.startsWith('/portal')
  const listHref = portal ? '/portal/idesign/orders' : '/admin/idesign/orders'
  const [data, setData] = useState<DetailPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const response = await fetch(`/api/idesign/cases/${caseId}`, { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error ?? 'Unable to load case')
    else { setData(payload); setError(null) }
    setLoading(false)
  }, [caseId])

  useEffect(() => { void load() }, [load])
  if (loading && !data) return <div className="py-20 text-center text-sm text-text-muted">Loading case...</div>
  if (!data) return <div className="rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error ?? 'Case not found'}</div>

  return <div className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><Link href={listHref} className="grid h-9 w-9 place-items-center rounded-card border border-border bg-surface text-text-muted hover:bg-bg hover:text-text" title="Back to orders"><MorphIcon icon={ArrowLeft} hoverIcon={MoveLeft} className="h-4 w-4" /></Link><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold text-text">{data.case.patientName}</h1>{data.permissions.canManagePlans ? <StatusSelect caseId={caseId} value={data.case.latestProgress} reload={load} /> : <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${IDESIGN_PROGRESS_STYLES[data.case.latestProgress] ?? 'border-border bg-bg text-text-muted'}`}>{data.case.latestProgress}</span>}</div><p className="mt-1 text-sm text-text-muted">{data.case.orderNo}</p></div></div>
      <IDesignNotifications />
    </header>
    {error && <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

    <section className="grid gap-px overflow-hidden rounded-card border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
      <Summary label="Doctor" value={data.case.doctorName || 'Unassigned'} />
      <Summary label="Sales" value={data.case.salesName || 'Unassigned'} />
      <Summary label="Date of birth" value={formatDate(data.case.dateOfBirth)} />
      <Summary label="Plan status" value={titleCase(data.case.planReviewStatus)} />
    </section>

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
      <div className="space-y-5">
        <TreatmentPlanPanel data={data} caseId={caseId} reload={load} />
        <WearSchedulePanel course={data.course} importedTotalSteps={Number(data.importedOrder?.totalSteps) || undefined} canManage={data.permissions.canManageSchedule} caseId={caseId} reload={load} />
        <CaseInformation data={data} />
      </div>
      <ActivityPanel activities={data.activities} />
    </div>
  </div>
}

function TreatmentPlanPanel({ data, caseId, reload }: { data: DetailPayload; caseId: number; reload: () => Promise<void> }) {
  const [reviewUrl, setReviewUrl] = useState('')
  const [editableUrl, setEditableUrl] = useState(data.case.currentEditableUrl ?? '')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latest = data.plans[0]

  const publish = async () => {
    setBusy(true); setError(null)
    const response = await fetch(`/api/idesign/cases/${caseId}/plans`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewUrl, editableUrl, summary }) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error ?? 'Unable to publish plan')
    else { setReviewUrl(''); setSummary(''); await reload() }
    setBusy(false)
  }
  const action = async (name: 'approve' | 'review_complete' | 'update_editable') => {
    setBusy(true); setError(null)
    const response = await fetch(`/api/idesign/cases/${caseId}/plans`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(name === 'update_editable' ? { action: name, editableUrl } : { action: name }) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error ?? 'Unable to update review')
    else await reload()
    setBusy(false)
  }

  return <section className="overflow-hidden rounded-card border border-border bg-surface">
    <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold text-text">Treatment Plan</h2><p className="mt-1 text-xs text-text-muted">Review, edit and approve the latest clinical design.</p></div>{latest && <span className="w-fit rounded bg-bg px-2 py-1 text-xs font-semibold text-text">Current: V{latest.versionNumber}</span>}</div>
    <div className="space-y-4 p-4">
      {!latest ? <div className="rounded-card border border-dashed border-border py-10 text-center"><p className="text-sm font-medium text-text">No treatment plan published</p><p className="mt-1 text-xs text-text-muted">The plan will appear here when it is ready for review.</p></div> : <div className="flex flex-col gap-4 rounded-card border border-border bg-bg p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><p className="font-semibold text-text">Treatment Plan V{latest.versionNumber}</p><span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium capitalize text-text-muted">{latest.status}</span></div><p className="mt-1 text-xs text-text-muted">Published {formatDate(latest.publishedAt)}{latest.summary ? ` · ${latest.summary}` : ''}</p></div><div className="flex flex-wrap gap-2"><a href={`/api/idesign/cases/${caseId}/open?type=review&version=${latest.versionNumber}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-card bg-text px-3 text-xs font-semibold text-white hover:bg-neutral-700"><MorphIcon icon={ExternalLink} className="h-3.5 w-3.5" />Review Treatment Plan</a>{data.permissions.canViewEditablePlan && data.case.currentEditableUrl && <a href={`/api/idesign/cases/${caseId}/open?type=edit`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-card border border-border bg-surface px-3 text-xs font-semibold text-text hover:bg-bg"><MorphIcon icon={ExternalLink} className="h-3.5 w-3.5" />Open Plan Editor</a>}</div></div>}

      {data.permissions.canApprovePlans && latest && latest.status !== 'approved' && <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void action('approve')} className="inline-flex h-10 items-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"><MorphIcon icon={Check} hoverIcon={BadgeCheck} className="h-4 w-4" />Approve Treatment Plan</button>{latest.status !== 'review_completed' && <button type="button" disabled={busy} onClick={() => void action('review_complete')} className="inline-flex h-10 items-center gap-2 rounded-card border border-border px-4 text-sm font-semibold text-text hover:bg-bg disabled:opacity-50"><MorphIcon icon={RefreshCcw} className="h-4 w-4" />Finish Review & Notify Lab</button>}</div>}

      {data.permissions.canManagePlans && <details className="rounded-card border border-border"><summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-text">Publish a new plan version</summary><div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2"><Field label="Review link"><input type="url" value={reviewUrl} onChange={(event) => setReviewUrl(event.target.value)} placeholder="https://..." className={inputClass} /></Field><Field label="Current editable link"><input type="url" value={editableUrl} onChange={(event) => setEditableUrl(event.target.value)} placeholder="https://..." className={inputClass} /></Field><label className="sm:col-span-2"><span className="mb-1 block text-xs font-medium text-text-muted">Version summary</span><input value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={500} placeholder="Optional internal summary" className={inputClass} /></label><div className="sm:col-span-2"><button type="button" disabled={busy || !reviewUrl} onClick={() => void publish()} className="inline-flex h-10 items-center gap-2 rounded-card bg-text px-4 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-40"><MorphIcon icon={Plus} hoverIcon={Save} className="h-4 w-4" />{busy ? 'Publishing...' : `Publish V${(latest?.versionNumber ?? 0) + 1}`}</button></div></div></details>}
      {data.permissions.canManagePlans && latest && <details className="rounded-card border border-border"><summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-text">Manage current plan editor link</summary><div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-end"><Field label="Editable link"><input type="url" value={editableUrl} onChange={(event) => setEditableUrl(event.target.value)} placeholder="https://..." className={inputClass} /></Field><button type="button" disabled={busy || !editableUrl} onClick={() => void action('update_editable')} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-card bg-text px-4 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-40"><MorphIcon icon={Save} className="h-4 w-4" />Save Editor Link</button></div></details>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {data.plans.length > 1 && <details><summary className="cursor-pointer text-xs font-semibold text-text-muted">View {data.plans.length - 1} previous version{data.plans.length === 2 ? '' : 's'}</summary><div className="mt-3 divide-y divide-border rounded-card border border-border">{data.plans.slice(1).map((plan) => <div key={plan.id} className="flex items-center justify-between gap-3 px-3 py-2.5"><div><p className="text-sm font-medium text-text">V{plan.versionNumber}</p><p className="text-xs text-text-muted">{formatDate(plan.publishedAt)} · {plan.status}</p></div><a href={`/api/idesign/cases/${caseId}/open?type=review&version=${plan.versionNumber}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-text hover:underline">Review</a></div>)}</div></details>}
    </div>
  </section>
}

function WearSchedulePanel({ course, importedTotalSteps, canManage, caseId, reload }: { course: CourseRow | null; importedTotalSteps?: number; canManage: boolean; caseId: number; reload: () => Promise<void> }) {
  const today = localDateValue(new Date())
  const [startDate, setStartDate] = useState(today)
  const [totalSteps, setTotalSteps] = useState(Math.max(1, importedTotalSteps ?? 10))
  const [durations, setDurations] = useState<number[]>(Array.from({ length: Math.max(1, importedTotalSteps ?? 10) }, () => 10))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (course) setDurations(course.steps.map((step) => step.durationDays))
  }, [course])
  const resize = (count: number) => { const safe = Math.min(100, Math.max(1, count)); setTotalSteps(safe); setDurations((current) => Array.from({ length: safe }, (_, index) => current[index] ?? 10)) }
  const request = async (method: 'POST' | 'PATCH', body: Record<string, unknown>) => {
    setBusy(true); setError(null)
    const response = await fetch(`/api/idesign/cases/${caseId}/schedule`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error ?? 'Unable to update schedule')
    else await reload()
    setBusy(false)
  }

  return <section className="overflow-hidden rounded-card border border-border bg-surface">
    <div className="border-b border-border px-4 py-4"><h2 className="text-sm font-semibold text-text">Patient Wear Schedule</h2><p className="mt-1 text-xs text-text-muted">Suggested timing only. The doctor or clinic staff confirms every step change.</p></div>
    <div className="space-y-4 p-4">{!course ? canManage ? <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Field label="First wear date"><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} /></Field><Field label="Total steps"><input type="number" min={1} max={100} value={totalSteps} onChange={(event) => resize(Number(event.target.value))} className={inputClass} /></Field><Field label="Apply duration to all"><div className="grid grid-cols-3 gap-1">{[{ label: '7 days', value: 7 }, { label: '10 days', value: 10 }, { label: '2 weeks', value: 14 }].map((option) => <button key={option.value} type="button" onClick={() => setDurations(Array.from({ length: totalSteps }, () => option.value))} className="h-10 rounded-card border border-border text-xs font-medium hover:bg-bg">{option.label}</button>)}</div></Field></div><DurationGrid durations={durations} currentStep={1} onChange={(index, value) => setDurations((current) => current.map((duration, durationIndex) => durationIndex === index ? value : duration))} /><button type="button" disabled={busy} onClick={() => void request('POST', { startDate, totalSteps, defaultDurationDays: 10, durations, timezone: 'Asia/Jakarta' })} className="inline-flex h-10 items-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"><MorphIcon icon={Play} className="h-4 w-4" />Start Wear Schedule</button></div> : <p className="py-8 text-center text-sm text-text-muted">The doctor or linked clinic staff can start the wear schedule.</p> : <><div className="grid gap-3 sm:grid-cols-4"><Summary label="Progress" value={`Step ${course.currentStep} of ${course.totalSteps}`} /><Summary label="Next suggested change" value={formatDate(course.nextSuggestedChange)} /><Summary label="Estimated finish" value={formatDate(course.currentEstimatedFinish)} /><Summary label="Schedule status" value={titleCase(course.status)} /></div><div className="h-2 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full bg-text transition-[width]" style={{ width: `${Math.min(100, course.currentStep / course.totalSteps * 100)}%` }} /></div>{canManage && <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || course.status === 'paused' || course.status === 'completed'} onClick={() => void request('PATCH', { action: 'advance', actualDate: today })} className="inline-flex h-9 items-center gap-2 rounded-card bg-text px-3 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-40"><MorphIcon icon={Check} hoverIcon={BadgeCheck} className="h-3.5 w-3.5" />{course.currentStep === course.totalSteps ? 'Complete Treatment' : `Confirm Step ${course.currentStep + 1}`}</button>{course.status === 'paused' ? <button type="button" disabled={busy} onClick={() => void request('PATCH', { action: 'resume', actualDate: today })} className="inline-flex h-9 items-center gap-2 rounded-card border border-border px-3 text-xs font-semibold hover:bg-bg"><MorphIcon icon={Play} className="h-3.5 w-3.5" />Resume</button> : course.status !== 'completed' && <button type="button" disabled={busy} onClick={() => void request('PATCH', { action: 'pause' })} className="inline-flex h-9 items-center gap-2 rounded-card border border-border px-3 text-xs font-semibold hover:bg-bg"><MorphIcon icon={CirclePause} className="h-3.5 w-3.5" />Pause</button>}</div>}{canManage && course.status !== 'completed' && <details className="rounded-card border border-border"><summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-semibold text-text">Edit future step durations</summary><div className="space-y-3 border-t border-border p-3"><DurationGrid durations={durations} currentStep={course.currentStep} onChange={(index, value) => setDurations((current) => current.map((duration, durationIndex) => durationIndex === index ? value : duration))} /><button type="button" disabled={busy} onClick={() => void request('PATCH', { action: 'update_durations', durations })} className="inline-flex h-9 items-center gap-2 rounded-card bg-text px-3 text-xs font-semibold text-white hover:bg-neutral-700"><MorphIcon icon={Save} className="h-3.5 w-3.5" />Update Schedule</button></div></details>}<div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="border-b border-border text-xs uppercase text-text-muted"><tr><th className="px-3 py-2">Step</th><th className="px-3 py-2">Duration</th><th className="px-3 py-2">Suggested start</th><th className="px-3 py-2">Suggested end</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{course.steps.map((step) => <tr key={step.id} className="border-b border-border last:border-0"><td className="px-3 py-2 text-sm font-medium">{step.stepNumber}</td><td className="px-3 py-2 text-sm">{step.durationDays} days</td><td className="px-3 py-2 text-sm text-text-muted">{formatDate(step.actualStartDate || step.suggestedStartDate)}</td><td className="px-3 py-2 text-sm text-text-muted">{formatDate(step.suggestedEndDate)}</td><td className="px-3 py-2 text-xs capitalize text-text-muted">{step.status}</td></tr>)}</tbody></table></div></>}{error && <p role="alert" className="text-sm text-red-600">{error}</p>}</div>
  </section>
}

function DurationGrid({ durations, currentStep, onChange }: { durations: number[]; currentStep: number; onChange: (index: number, value: number) => void }) {
  return <div className="max-h-64 overflow-y-auto rounded-card border border-border"><div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">{durations.map((duration, index) => <label key={index} className={`bg-surface p-2 ${index + 1 < currentStep ? 'opacity-50' : ''}`}><span className="mb-1 block text-[10px] font-medium text-text-muted">Step {index + 1}</span><span className="relative block"><input type="number" min={1} max={60} disabled={index + 1 < currentStep} value={duration} onChange={(event) => onChange(index, Math.min(60, Math.max(1, Number(event.target.value) || 1)))} className="h-8 w-full rounded border border-border bg-surface pl-2 pr-9 text-xs" /><span className="pointer-events-none absolute right-2 top-2 text-[10px] text-text-muted">days</span></span></label>)}</div></div>
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

function CaseInformation({ data }: { data: DetailPayload }) {
  const files = data.case.fileUrls && typeof data.case.fileUrls === 'object' ? data.case.fileUrls as Record<string, Array<{ url: string; name: string }>> : {}
  return <section className="overflow-hidden rounded-card border border-border bg-surface"><div className="border-b border-border px-4 py-4"><h2 className="text-sm font-semibold text-text">Case Information</h2></div><div className="grid gap-5 p-4 md:grid-cols-2"><div><h3 className="text-xs font-semibold uppercase text-text-muted">Clinical details</h3><dl className="mt-3 space-y-2 text-sm"><Definition label="Gender" value={data.case.gender || 'Not recorded'} /><Definition label="Dentition" value={data.case.dentitionStage || 'Not recorded'} /><Definition label="Remarks" value={data.case.remarks || 'None'} />{data.importedOrder?.purchasedProducts && <Definition label="Product" value={data.importedOrder.purchasedProducts} />}</dl></div><div><h3 className="text-xs font-semibold uppercase text-text-muted">Case files</h3><div className="mt-3 space-y-2">{Object.values(files).flat().length === 0 ? <p className="text-sm text-text-muted">No files uploaded.</p> : Object.entries(files).flatMap(([slot, entries]) => entries.map((file, index) => <a key={`${slot}-${index}`} href={file.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded border border-border px-3 py-2 text-sm text-text hover:bg-bg"><span className="truncate">{file.name}</span><span className="shrink-0 text-[10px] capitalize text-text-muted">{slot.replaceAll('-', ' ')}</span></a>))}</div></div></div></section>
}

function ActivityPanel({ activities }: { activities: DetailPayload['activities'] }) {
  return <section className="sticky top-5 overflow-hidden rounded-card border border-border bg-surface"><div className="border-b border-border px-4 py-4"><h2 className="text-sm font-semibold text-text">Activity</h2><p className="mt-1 text-xs text-text-muted">Plan, approval and schedule history</p></div><ol className="max-h-[720px] overflow-y-auto px-4 py-2">{activities.length === 0 ? <li className="py-10 text-center text-sm text-text-muted">No activity yet</li> : activities.map((activity) => <li key={activity.id} className="relative border-l border-border py-3 pl-4 before:absolute before:-left-1 before:top-5 before:h-2 before:w-2 before:rounded-full before:bg-text"><p className="text-sm text-text">{activity.detail}</p><p className="mt-1 text-[10px] text-text-muted">{formatDate(activity.createdAt)} · {activity.actorName}</p></li>)}</ol></section>
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="bg-surface px-4 py-3"><p className="text-[10px] font-semibold uppercase text-text-muted">{label}</p><p className="mt-1 truncate text-sm font-medium text-text">{value}</p></div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label><span className="mb-1 block text-xs font-medium text-text-muted">{label}</span>{children}</label> }
function Definition({ label, value }: { label: string; value: string }) { return <div className="grid grid-cols-[100px_1fr] gap-3"><dt className="text-text-muted">{label}</dt><dd className="break-words text-text">{value}</dd></div> }
function titleCase(value: string) { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function formatDate(value: string | null | undefined) { if (!value) return '—'; const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) }
function localDateValue(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}` }
const inputClass = 'h-10 w-full rounded-card border border-border bg-surface px-3 text-sm text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10'
