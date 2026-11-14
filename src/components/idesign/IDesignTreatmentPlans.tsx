'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { BadgeCheck, ExternalLink } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { getIDesignPlanApprovalState } from '@/lib/idesign/approval'

/** Shared button styles for clear aligner plans: view/review actions are black, approve actions are orange. */
export const IDESIGN_VIEW_BUTTON_CLASS = 'inline-flex h-8 max-md:h-11 max-md:px-4 max-md:text-xs items-center justify-center gap-1.5 whitespace-nowrap rounded-card bg-text px-2.5 text-[11px] font-semibold text-white hover:bg-neutral-700'
export const IDESIGN_APPROVE_BUTTON_CLASS = 'inline-flex h-8 max-md:h-11 max-md:px-4 max-md:text-xs items-center justify-center whitespace-nowrap rounded-card bg-primary px-2.5 text-[11px] font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary'
const APPROVED_BADGE_CLASS = 'inline-flex h-8 items-center justify-center whitespace-nowrap rounded-card bg-neutral-100 px-2.5 text-[11px] font-semibold text-text-muted'

export interface IDesignPlanRow { id: number; versionNumber: number; summary: string | null; status: string; editableUrl: string | null; publishedAt: string; approvedAt: string | null; createdByName: string | null; approvedByName: string | null }

export function getTreatmentPlanOverview(plans: IDesignPlanRow[], latestProgress: string) {
  const latest = plans[0]
  const approvedPlan = plans.find((plan) => plan.status === 'approved')
  const implicitApproval = Boolean(latest && !approvedPlan && getIDesignPlanApprovalState(latestProgress, latest.status).approved)
  const featuredPlan = approvedPlan ?? latest
  return { latest, approvedPlan, implicitApproval, featuredPlan, approvalLocked: Boolean(approvedPlan) || implicitApproval, otherPlans: plans.filter((plan) => plan.id !== featuredPlan?.id) }
}

/** Plan versions with View Plan / Approve actions, shared by the order detail page and the orders list. */
export function TreatmentPlanList({ caseId, plans, latestProgress, currentEditableUrl, canApprovePlans, canViewEditablePlan, busy, onApprove, children }: {
  caseId: number
  plans: IDesignPlanRow[]
  latestProgress: string
  currentEditableUrl: string | null
  canApprovePlans: boolean
  canViewEditablePlan: boolean
  busy: boolean
  onApprove: (plan: IDesignPlanRow) => void
  /** Rendered between the featured plan and the other versions. */
  children?: ReactNode
}) {
  const { latest, approvedPlan, implicitApproval, featuredPlan, approvalLocked, otherPlans } = getTreatmentPlanOverview(plans, latestProgress)

  const planActions = (plan: IDesignPlanRow) => {
    const canView = canViewEditablePlan && Boolean(plan.editableUrl || currentEditableUrl)
    const isApprovedPlan = plan.id === approvedPlan?.id || (implicitApproval && plan.id === latest?.id)
    const readyForApproval = getIDesignPlanApprovalState(latestProgress, plan.status).readyForApproval
    return <div className="flex shrink-0 items-center gap-2">
      {canView ? <a href={`/api/idesign/cases/${caseId}/open?planId=${plan.id}`} target="_blank" rel="noreferrer" className={IDESIGN_VIEW_BUTTON_CLASS}><MorphIcon icon={ExternalLink} className="h-3 w-3" />View Plan</a> : <span className="inline-flex h-8 items-center rounded-card border border-border bg-neutral-100 px-2.5 text-[11px] font-semibold text-text-muted">No Link</span>}
      {isApprovedPlan ? <span className={APPROVED_BADGE_CLASS}>Approved</span> : <button type="button" disabled={busy || approvalLocked || !canApprovePlans || !readyForApproval} onClick={() => onApprove(plan)} className={IDESIGN_APPROVE_BUTTON_CLASS}>Approve</button>}
    </div>
  }

  return <>
    {!featuredPlan ? <div className="rounded-card border border-dashed border-border py-10 text-center"><p className="text-sm font-medium text-text">No treatment plan published</p><p className="mt-1 text-xs text-text-muted">The plan will appear here when it is ready for review.</p></div> : <div className="flex flex-col gap-3 rounded-card border border-border bg-bg p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-text">Treatment Plan V{featuredPlan.versionNumber}</p><span className="rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium capitalize text-text-muted">{featuredPlan.status}</span></div><p className="mt-1 text-xs text-text-muted">Published {formatDate(featuredPlan.publishedAt)}{featuredPlan.summary ? ` · ${featuredPlan.summary}` : ''}</p></div>{planActions(featuredPlan)}</div>}
    {children}
    {otherPlans.length > 0 && <details><summary className="cursor-pointer text-xs font-semibold text-text-muted">View {otherPlans.length} other version{otherPlans.length === 1 ? '' : 's'}</summary><div className="mt-3 divide-y divide-border rounded-card border border-border">{otherPlans.map((plan) => <div key={plan.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium text-text">V{plan.versionNumber}</p><p className="text-xs capitalize text-text-muted">{formatDate(plan.publishedAt)} · {plan.status}</p></div>{planActions(plan)}</div>)}</div></details>}
  </>
}

export function TreatmentPlanHeader({ plans, latestProgress, description = 'Review and approve a clinical design.' }: { plans: IDesignPlanRow[]; latestProgress: string; description?: string }) {
  const { approvedPlan, implicitApproval, featuredPlan } = getTreatmentPlanOverview(plans, latestProgress)
  return <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className="h-4 w-1 shrink-0 rounded-full bg-primary" aria-hidden /><h2 className="text-sm font-semibold text-text">Treatment Plan</h2></div><p className="mt-1 text-xs text-text-muted">{description}</p></div>{featuredPlan && <span className="w-fit rounded bg-bg px-2 py-1 text-xs font-semibold text-text">{approvedPlan || implicitApproval ? 'Approved' : 'Latest'}: V{featuredPlan.versionNumber}</span>}</div>
}

/** PATCH used by both the detail page and the list to approve a specific plan version. */
export async function approveIDesignPlan(caseId: number, planId: number): Promise<string | null> {
  const response = await fetch(`/api/idesign/cases/${caseId}/plans`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'approve', planId }) })
  if (response.ok) return null
  const payload = await response.json().catch(() => ({}))
  return payload.error ?? 'Unable to approve the treatment plan'
}

interface PlanReviewPayload {
  case: { patientName: string; latestProgress: string; currentEditableUrl: string | null }
  plans: IDesignPlanRow[]
  permissions: { canApprovePlans: boolean; canViewEditablePlan: boolean }
}

/** Expandable plan review used inline on the clear aligner orders list. */
export function IDesignPlanReviewPanel({ caseId, onApproved }: { caseId: number; onApproved: () => Promise<void> }) {
  const [data, setData] = useState<PlanReviewPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingPlan, setPendingPlan] = useState<IDesignPlanRow | null>(null)
  const [approving, setApproving] = useState(false)

  const load = useCallback(async () => {
    const response = await fetch(`/api/idesign/cases/${caseId}`, { cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) setError(payload.error ?? 'Unable to load treatment plans')
    else { setData(payload); setError(null) }
  }, [caseId])

  useEffect(() => { void load() }, [load])

  const confirmApproval = async () => {
    if (!pendingPlan) return
    setApproving(true)
    setError(null)
    const approvalError = await approveIDesignPlan(caseId, pendingPlan.id)
    setApproving(false)
    if (approvalError) { setError(approvalError); setPendingPlan(null); return }
    setPendingPlan(null)
    await load()
    await onApproved()
  }

  return <section className="overflow-hidden rounded-card border border-border bg-surface">
    {data ? <TreatmentPlanHeader plans={data.plans} latestProgress={data.case.latestProgress} description="Preview each plan version and approve the one to produce." /> : <div className="border-b border-border px-4 py-4"><div className="flex items-center gap-2"><span className="h-4 w-1 shrink-0 rounded-full bg-primary" aria-hidden /><h2 className="text-sm font-semibold text-text">Treatment Plan</h2></div></div>}
    <div className="space-y-4 p-4">
      {data ? <TreatmentPlanList caseId={caseId} plans={data.plans} latestProgress={data.case.latestProgress} currentEditableUrl={data.case.currentEditableUrl} canApprovePlans={data.permissions.canApprovePlans} canViewEditablePlan={data.permissions.canViewEditablePlan} busy={approving} onApprove={setPendingPlan} /> : !error && <p className="py-6 text-center text-sm text-text-muted">Loading treatment plans...</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
    {pendingPlan && data && <PlanApprovalDialog patientName={data.case.patientName} versionNumber={pendingPlan.versionNumber} approving={approving} onCancel={() => setPendingPlan(null)} onConfirm={() => void confirmApproval()} />}
  </section>
}

function PlanApprovalDialog({ patientName, versionNumber, approving, onCancel, onConfirm }: { patientName: string; versionNumber: number; approving: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !approving) onCancel() }}><div role="dialog" aria-modal="true" aria-labelledby="approve-plan-title" className="w-full max-w-md rounded-card border border-border bg-surface p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-orange-50 text-primary"><MorphIcon icon={BadgeCheck} className="h-5 w-5" /></span><div><h2 id="approve-plan-title" className="text-base font-semibold text-text">Approve treatment plan?</h2><p className="mt-2 text-sm leading-6 text-text-muted">By approving Plan V{versionNumber} for {patientName}, you authorize BrightArk to begin production and acknowledge that production fees will apply.</p></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={approving} onClick={onCancel} className="h-9 rounded border border-border px-3 text-sm font-semibold text-text hover:bg-bg disabled:opacity-50">Cancel</button><button type="button" disabled={approving} onClick={onConfirm} className="h-9 rounded bg-primary px-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">{approving ? 'Approving...' : 'Confirm & Approve'}</button></div></div></div>
}

function formatDate(value: string | null | undefined) { if (!value) return '—'; const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) }
