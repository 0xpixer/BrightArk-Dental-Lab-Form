'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { IconNode } from 'lucide'
import {
  Activity,
  ArrowRight,
  CalendarClock,
  ChartColumn,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  ClipboardCheck,
  Clock3,
  Factory,
  Inbox,
  Layers,
  Package,
  PackageCheck,
  Plus,
  RefreshCw,
  Sparkles,
  Stethoscope,
  TriangleAlert,
  Truck,
  Users,
  Wallet,
} from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { IDesignPlanReviewPanel } from '@/components/idesign/IDesignTreatmentPlans'
import { IDESIGN_PROGRESS_COLORS, IDESIGN_PROGRESS_OPTIONS, IDESIGN_PROGRESS_STYLES } from '@/lib/idesign/orders'
import { ORDER_STATUS_CHART_COLORS, ORDER_STATUS_LABELS, ORDER_STATUS_OPTIONS, ORDER_STATUS_STYLES } from '@/lib/orderStatus'
import type { CurrencyAmount, PartnerCaseItem, PartnerLabItem, PartnerWearItem, TrendPoint } from '@/lib/overview/partner'

type Tab = 'aligners' | 'lab'

export interface PartnerOverviewPaths {
  alignerOrders: string
  labOrders: string
  finance: string
  newAligner: string | null
  newLab: string | null
}

interface DoctorSummary { id: number; name: string; activeAligners: number; awaitingApproval: number; activeLabOrders: number }

interface BasePayload {
  role: 'portal' | 'sales'
  doctorName: string | null
  doctors: Array<{ id: number; name: string }>
  selectedDoctorId: number | null
  finance: { unpaidCount: number; overdueCount: number; unpaid: CurrencyAmount[]; overdue: CurrencyAmount[]; overdueDays: number }
  doctorSummaries: DoctorSummary[]
  generatedAt: string
}

interface AlignerPayload extends BasePayload {
  aligners: {
    totals: { all: number; active: number; newThisMonth: number; completed: number; awaitingApproval: number; wearing: number }
    pipeline: Record<string, number>
    awaitingApproval: PartnerCaseItem[]
    enteringInfo: PartnerCaseItem[]
    enteringInfoCount: number
    needsSchedule: PartnerCaseItem[]
    needsScheduleCount: number
    wearing: PartnerWearItem[]
    wearDueSoonCount: number
    trend: TrendPoint[]
  }
  activity: Array<{ id: number; caseId: number; eventType: string; detail: string; actorName: string; createdAt: string; patientName: string; orderNo: string }>
}

interface LabPayload extends BasePayload {
  lab: {
    metrics: { totals: { all: number; active: number; completed: number; overdue: number }; statusCounts: Record<string, number>; trend: TrendPoint[] }
    redo: PartnerLabItem[]
    inTransit: PartnerLabItem[]
    inTransitCount: number
    productMix: Array<{ label: string; count: number }>
    newMessages: Array<{ orderId: number; orderNo: string; patientName: string; latestMessageAt: string }>
    drafts: Array<{ id: number; patientName: string; updatedAt: string }>
  }
}

// ---------- formatting helpers ----------

function formatMoney({ currency, amount }: CurrencyAmount) {
  const digits = currency === 'IDR' ? 0 : 2
  const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(amount)
  return currency === '—' ? number : `${currency} ${number}`
}

function relativeDate(value: string) {
  const days = Math.floor((Date.now() - Date.parse(value)) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function shortDate(value: string | null) {
  return value ? new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : '—'
}

function waitingLabel(value: string) {
  const days = Math.floor((Date.now() - Date.parse(value)) / 86_400_000)
  return days <= 0 ? 'ready today' : `waiting ${days} ${days === 1 ? 'day' : 'days'}`
}

function greeting() {
  const hour = new Date().getHours()
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

// ---------- main component ----------

export function PartnerOverview({ paths, userName }: { paths: PartnerOverviewPaths; userName: string | null }) {
  const [tab, setTab] = useState<Tab>('aligners')
  const [doctorId, setDoctorId] = useState('all')
  const [data, setData] = useState<AlignerPayload | LabPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Time-of-day greeting is client-only so the server render (different timezone) never mismatches.
  const [salutation, setSalutation] = useState('Welcome back')
  useEffect(() => { setSalutation(greeting()) }, [])

  // Remember the tab in the URL so a refresh or a shared link opens the same view.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab')
    if (requested === 'lab') setTab('lab')
  }, [])

  const selectTab = (next: Tab) => {
    setTab(next)
    const url = new URL(window.location.href)
    if (next === 'lab') url.searchParams.set('tab', 'lab')
    else url.searchParams.delete('tab')
    window.history.replaceState(null, '', url)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ tab })
    if (doctorId !== 'all') params.set('doctorId', doctorId)
    try {
      const response = await fetch(`/api/overview/partner?${params}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Unable to load the overview')
      setData(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the overview')
    } finally {
      setLoading(false)
    }
  }, [tab, doctorId])

  useEffect(() => { void load() }, [load])

  const isSales = data?.role === 'sales'
  const alignerData = data && 'aligners' in data ? data : null
  const labData = data && 'lab' in data ? data : null
  const displayName = data?.role === 'portal' ? data.doctorName ?? userName : userName

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-10">
      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Overview</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight text-text sm:text-[28px]">{salutation}{displayName ? `, ${displayName}` : ''}</h1>
          <p className="mt-1 text-sm text-text-muted">{isSales ? 'Here is what is happening across your doctors today.' : 'Here is what needs your attention today.'}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          {paths.newAligner && <Link href={paths.newAligner} className="inline-flex h-11 items-center justify-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#e06d15] sm:h-10"><MorphIcon icon={Plus} className="h-4 w-4" /><span className="truncate"><span className="sm:hidden">Aligner Order</span><span className="hidden sm:inline">New Aligner Order</span></span></Link>}
          {paths.newLab && <Link href={paths.newLab} className="inline-flex h-11 items-center justify-center gap-2 rounded-card bg-text px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-neutral-700 sm:h-10"><MorphIcon icon={Plus} className="h-4 w-4" /><span className="truncate"><span className="sm:hidden">Lab Order</span><span className="hidden sm:inline">New Lab Order</span></span></Link>}
        </div>
      </header>

      {/* Tabs + doctor filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="grid grid-cols-2 rounded-card border border-border bg-surface p-1 sm:inline-grid sm:w-auto" aria-label="Overview section">
          {([['aligners', 'Clear Aligners'], ['lab', 'Dental Lab']] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => selectTab(value)} aria-pressed={tab === value} className={`h-10 rounded px-5 text-sm font-semibold transition-colors sm:h-9 ${tab === value ? 'bg-text text-white shadow-sm' : 'text-text-muted hover:text-text'}`}>{label}</button>
          ))}
        </nav>
        {isSales && data && (
          <label className="flex items-center gap-2 text-xs font-medium text-text-muted">
            <MorphIcon icon={Stethoscope} className="h-4 w-4 shrink-0" />
            <span className="sr-only sm:not-sr-only">Doctor</span>
            <select value={doctorId} onChange={(event) => setDoctorId(event.target.value)} className="h-10 w-full min-w-0 rounded-card border border-border bg-surface px-3 text-sm text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10 sm:w-56">
              <option value="all">All my doctors ({data.doctors.length})</option>
              {data.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
            </select>
          </label>
        )}
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="grid h-9 w-9 place-items-center rounded hover:bg-red-100" title="Retry"><MorphIcon icon={RefreshCw} className="h-4 w-4" /><span className="sr-only">Retry</span></button>
        </div>
      )}

      {data && <FinanceBanner finance={data.finance} href={paths.finance} />}

      {tab === 'aligners'
        ? <AlignerTab data={alignerData} loading={loading || !alignerData} paths={paths} reload={load} />
        : <LabTab data={labData} loading={loading || !labData} paths={paths} />}

      {isSales && data && data.doctorSummaries.length > 0 && <DoctorTable doctors={data.doctorSummaries} onSelect={(id) => setDoctorId(String(id))} />}

      {data && <p className="text-right text-[11px] text-text-muted">Updated {new Date(data.generatedAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}</p>}
    </div>
  )
}

// ---------- shared building blocks ----------

function Panel({ title, subtitle, icon, action, children, className = '' }: { title: string; subtitle?: string; icon: IconNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-card border border-border bg-surface ${className}`}>
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-bg text-text"><MorphIcon icon={icon} className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-text">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="min-w-0 flex-1 px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
    </section>
  )
}

function CountBadge({ value, tone = 'neutral' }: { value: number; tone?: 'neutral' | 'alert' | 'primary' }) {
  if (!value) return null
  const style = tone === 'alert' ? 'bg-red-500 text-white' : tone === 'primary' ? 'bg-primary text-white' : 'bg-bg text-text'
  return <span className={`grid h-6 min-w-6 shrink-0 place-items-center rounded-full px-2 text-xs font-semibold tabular-nums ${style}`}>{value}</span>
}

function ViewAll({ href, label = 'View all' }: { href: string; label?: string }) {
  return <Link href={href} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-card px-2 text-xs font-semibold text-text-muted transition-colors hover:bg-bg hover:text-text">{label}<MorphIcon icon={ChevronRight} className="h-3.5 w-3.5" /></Link>
}

function KpiCard({ label, value, hint, icon, href, accent = false, loading }: { label: string; value: ReactNode; hint?: ReactNode; icon: IconNode; href: string; accent?: boolean; loading: boolean }) {
  return (
    <Link href={href} className={`group relative flex min-w-0 flex-col overflow-hidden rounded-card border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-text/10 ${accent ? 'border-[#f6b978] bg-[#fff7ed]' : 'border-border bg-surface hover:border-neutral-300'}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-text-muted">{label}</p>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${accent ? 'bg-primary text-white' : 'bg-bg text-text'}`}><MorphIcon icon={icon} className="h-3.5 w-3.5" /></span>
      </div>
      <p className="mt-3 truncate text-[26px] font-semibold leading-none tabular-nums text-text">{loading ? <span className="inline-block h-6 w-12 animate-pulse rounded bg-border align-middle" /> : value}</p>
      {hint && <p className="mt-2 truncate text-[11px] text-text-muted">{loading ? ' ' : hint}</p>}
    </Link>
  )
}

function EmptyState({ icon, title, body }: { icon: IconNode; title: string; body: string }) {
  return (
    <div className="grid place-items-center rounded-card border border-dashed border-border px-4 py-8 text-center">
      <div>
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-bg text-text-muted"><MorphIcon icon={icon} className="h-5 w-5" /></span>
        <p className="mt-3 text-sm font-medium text-text">{title}</p>
        <p className="mt-1 text-xs text-text-muted">{body}</p>
      </div>
    </div>
  )
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-2">{Array.from({ length: rows }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-card bg-bg" />)}</div>
}

function RowLink({ href, title, subtitle, trailing }: { href: string; title: string; subtitle: ReactNode; trailing?: ReactNode }) {
  return (
    <Link href={href} className="grid min-h-[56px] grid-cols-[1fr_auto] items-center gap-3 rounded-card px-3 py-2.5 transition-colors hover:bg-bg focus:outline-none focus:ring-2 focus:ring-inset focus:ring-text/10">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-text">{title}</p>
        <p className="mt-0.5 truncate text-xs text-text-muted">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">{trailing}<MorphIcon icon={ChevronRight} className="h-4 w-4 text-text-muted" /></div>
    </Link>
  )
}

function FinanceBanner({ finance, href }: { finance: BasePayload['finance']; href: string }) {
  if (finance.unpaidCount === 0) return null
  const overdue = finance.overdueCount > 0
  const amounts = (overdue ? finance.overdue : finance.unpaid).map(formatMoney).join(' · ')
  return (
    <Link href={overdue ? `${href}?overdue=1` : href} className={`flex items-center gap-3 rounded-card border px-4 py-3 transition-colors ${overdue ? 'border-red-200 bg-red-50 hover:bg-red-100/70' : 'border-border bg-surface hover:bg-bg'}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${overdue ? 'bg-red-500 text-white' : 'bg-bg text-text'}`}><MorphIcon icon={overdue ? TriangleAlert : Wallet} className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${overdue ? 'text-red-700' : 'text-text'}`}>
          {overdue ? `${finance.overdueCount} overdue ${finance.overdueCount === 1 ? 'payment' : 'payments'}` : `${finance.unpaidCount} unpaid ${finance.unpaidCount === 1 ? 'invoice' : 'invoices'}`}
        </p>
        <p className={`truncate text-xs ${overdue ? 'text-red-600' : 'text-text-muted'}`}>{amounts}{overdue && finance.unpaidCount > finance.overdueCount ? ` · ${finance.unpaidCount} unpaid in total` : ''}</p>
      </div>
      <span className="hidden items-center gap-1 text-xs font-semibold text-text sm:inline-flex">Open Finance<MorphIcon icon={ArrowRight} className="h-3.5 w-3.5" /></span>
      <MorphIcon icon={ChevronRight} className="h-4 w-4 text-text-muted sm:hidden" />
    </Link>
  )
}

function TrendBars({ points, loading, unit }: { points: TrendPoint[]; loading: boolean; unit: string }) {
  const max = Math.max(1, ...points.map((point) => point.count))
  const last = points.at(-1)
  return (
    <div>
      <div className="relative h-44 sm:h-52">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-6">
          {[0, 1, 2, 3].map((line) => <span key={line} className="border-t border-dashed border-border/80" />)}
        </div>
        <div className="relative flex h-full items-end justify-between gap-2 sm:gap-3">
          {(loading ? Array.from({ length: 6 }, (_, index) => ({ key: String(index), label: '', count: 0 })) : points).map((point) => {
            const current = point.key === last?.key
            return (
              <div key={point.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                <div className="flex w-full flex-1 items-end justify-center pt-5">
                  <div
                    className={`relative w-full max-w-10 rounded-t-md transition-[height] duration-500 ${loading ? 'h-1/2 animate-pulse bg-border' : current ? 'bg-primary' : 'bg-text'}`}
                    style={loading ? undefined : { height: point.count ? `${Math.max(6, point.count / max * 100)}%` : '3px', opacity: point.count ? 1 : 0.35 }}
                    title={`${point.label}: ${point.count} ${unit}`}
                  >
                    {!loading && <span className={`absolute inset-x-0 -top-5 text-center text-[11px] font-semibold tabular-nums ${current ? 'text-primary' : 'text-text'}`}>{point.count}</span>}
                  </div>
                </div>
                <span className="h-4 text-[11px] text-text-muted">{point.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Horizontal stacked bar with a tappable legend. Works at any width. */
function StackedDistribution({ segments, total, loading, hrefFor }: { segments: Array<{ key: string; label: string; count: number; color: string }>; total: number; loading: boolean; hrefFor?: (key: string) => string }) {
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-bg">
        {!loading && total > 0 && segments.filter((segment) => segment.count > 0).map((segment) => (
          <span key={segment.key} className="h-full transition-[width] duration-500 first:rounded-l-full last:rounded-r-full" style={{ width: `${segment.count / total * 100}%`, backgroundColor: segment.color }} title={`${segment.label}: ${segment.count}`} />
        ))}
        {loading && <span className="h-full w-full animate-pulse bg-border" />}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {segments.map((segment) => {
          const content = <>
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: segment.color, opacity: segment.count ? 1 : 0.35 }} />
            <span className={`min-w-0 flex-1 truncate ${segment.count ? 'text-text' : 'text-text-muted'}`}>{segment.label}</span>
            <span className="font-semibold tabular-nums text-text">{loading ? '—' : segment.count}</span>
          </>
          return (
            <li key={segment.key}>
              {hrefFor
                ? <Link href={hrefFor(segment.key)} className="flex min-h-[36px] items-center gap-2 rounded px-1.5 text-xs transition-colors hover:bg-bg">{content}</Link>
                : <div className="flex min-h-[36px] items-center gap-2 px-1.5 text-xs">{content}</div>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------- Clear Aligners tab ----------

function ProgressPill({ progress }: { progress: string }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${IDESIGN_PROGRESS_STYLES[progress] ?? 'border-border bg-bg text-text'}`}>{progress}</span>
}

function AlignerTab({ data, loading, paths, reload }: { data: AlignerPayload | null; loading: boolean; paths: PartnerOverviewPaths; reload: () => Promise<void> }) {
  const aligners = data?.aligners
  const totals = aligners?.totals
  const unpaid = data?.finance.unpaid ?? []
  const pipelineSegments = IDESIGN_PROGRESS_OPTIONS.map((status) => ({ key: status, label: status, count: aligners?.pipeline[status] ?? 0, color: IDESIGN_PROGRESS_COLORS[status] ?? '#a3a3a3' }))
  const attention = (totals?.awaitingApproval ?? 0) + (aligners?.enteringInfoCount ?? 0) + (aligners?.needsScheduleCount ?? 0)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="To approve" value={totals?.awaitingApproval ?? 0} hint={totals?.awaitingApproval ? 'Plans ready for review' : 'Nothing waiting'} icon={ClipboardCheck} href={paths.alignerOrders} accent={Boolean(totals?.awaitingApproval)} loading={loading} />
        <KpiCard label="Active cases" value={totals?.active ?? 0} hint={`${totals?.wearing ?? 0} currently wearing`} icon={Layers} href={paths.alignerOrders} loading={loading} />
        <KpiCard label="New this month" value={totals?.newThisMonth ?? 0} hint={`${totals?.completed ?? 0} completed overall`} icon={Sparkles} href={paths.alignerOrders} loading={loading} />
        <KpiCard label="Unpaid" value={data?.finance.unpaidCount ?? 0} hint={unpaid.length ? unpaid.map(formatMoney).join(' · ') : 'All settled'} icon={Wallet} href={paths.finance} loading={loading} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Needs your attention" subtitle={loading ? 'Loading…' : attention ? `${attention} ${attention === 1 ? 'case needs' : 'cases need'} an action` : 'You are all caught up'} icon={Inbox} action={<CountBadge value={attention} tone="primary" />}>
          {loading ? <ListSkeleton rows={4} /> : attention === 0 ? <EmptyState icon={CircleCheck} title="All caught up" body="New plans to review will appear here." /> : (
            <div className="space-y-5">
              {aligners!.awaitingApproval.length > 0 && (
                <AttentionGroup title="Plans awaiting approval" count={totals!.awaitingApproval} tone="primary">
                  {aligners!.awaitingApproval.map((item) => <ApprovalRow key={item.id} item={item} detailHref={`${paths.alignerOrders}/${item.id}`} showDoctor={data!.role === 'sales'} onApproved={reload} />)}
                </AttentionGroup>
              )}
              {aligners!.needsSchedule.length > 0 && (
                <AttentionGroup title="Wear schedule not set" count={aligners!.needsScheduleCount}>
                  {aligners!.needsSchedule.map((item) => <RowLink key={item.id} href={`${paths.alignerOrders}/${item.id}`} title={item.patientName} subtitle={<>{item.orderNo}{data!.role === 'sales' && item.doctorName ? ` · ${item.doctorName}` : ''}</>} trailing={<span className="hidden text-xs font-semibold text-primary sm:inline">Set schedule</span>} />)}
                </AttentionGroup>
              )}
              {aligners!.enteringInfo.length > 0 && (
                <AttentionGroup title="Case information incomplete" count={aligners!.enteringInfoCount}>
                  {aligners!.enteringInfo.map((item) => <RowLink key={item.id} href={`${paths.alignerOrders}/${item.id}`} title={item.patientName} subtitle={<>{item.orderNo} · updated {relativeDate(item.updatedAt).toLowerCase()}</>} trailing={<span className="hidden sm:inline-flex"><ProgressPill progress={item.latestProgress} /></span>} />)}
                </AttentionGroup>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Wear progress" subtitle={`Patients changing aligners within 7 days are flagged`} icon={CalendarClock} action={<CountBadge value={aligners?.wearDueSoonCount ?? 0} tone="alert" />}>
          {loading ? <ListSkeleton rows={4} /> : aligners!.wearing.length === 0 ? <EmptyState icon={Clock3} title="No active wear schedules" body="Set a schedule after a case is delivered to track progress." /> : (
            <ul className="space-y-1">
              {aligners!.wearing.map((item) => <WearRow key={item.id} item={item} href={`${paths.alignerOrders}/${item.id}`} />)}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Case pipeline" subtitle={`${totals?.all ?? 0} cases by current stage`} icon={Factory} action={<ViewAll href={paths.alignerOrders} />}>
          <StackedDistribution segments={pipelineSegments} total={totals?.all ?? 0} loading={loading} />
        </Panel>
        <Panel title="Case volume" subtitle="New cases per month · last 6 months" icon={ChartColumn}>
          <TrendBars points={aligners?.trend ?? []} loading={loading} unit="cases" />
        </Panel>
      </div>

      <Panel title="Recent activity" subtitle="Latest updates on your cases" icon={Activity}>
        {loading ? <ListSkeleton rows={4} /> : (data!.activity.length === 0 ? <EmptyState icon={Activity} title="No activity yet" body="Plan uploads, approvals and status changes show up here." /> : (
          <ol className="relative space-y-1 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-border">
            {data!.activity.map((item) => (
              <li key={item.id}>
                <Link href={`${paths.alignerOrders}/${item.caseId}`} className="relative grid grid-cols-[32px_1fr] gap-3 rounded-card py-2 pr-2 transition-colors hover:bg-bg">
                  <span className={`relative z-[1] mt-0.5 grid h-8 w-8 place-items-center rounded-full border-2 border-surface ${item.eventType === 'plan_approved' ? 'bg-green-500 text-white' : item.eventType.includes('plan') ? 'bg-primary text-white' : 'bg-bg text-text'}`}><MorphIcon icon={item.eventType === 'plan_approved' ? CircleCheck : item.eventType.includes('plan') ? ClipboardCheck : Activity} className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0">
                    <p className="text-sm text-text"><span className="font-semibold">{item.patientName}</span><span className="text-text-muted"> · {item.detail}</span></p>
                    <p className="mt-0.5 truncate text-[11px] text-text-muted">{item.orderNo} · {item.actorName} · {relativeDate(item.createdAt)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        ))}
      </Panel>
    </div>
  )
}

function AttentionGroup({ title, count, tone = 'neutral', children }: { title: string; count: number; tone?: 'neutral' | 'primary'; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <span className={`h-1.5 w-1.5 rounded-full ${tone === 'primary' ? 'bg-primary' : 'bg-text-muted'}`} />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{title}</h3>
        <span className="text-[11px] font-semibold tabular-nums text-text-muted">{count}</span>
      </div>
      <div className="divide-y divide-border rounded-card border border-border">{children}</div>
    </div>
  )
}

function ApprovalRow({ item, detailHref, showDoctor, onApproved }: { item: PartnerCaseItem; detailHref: string; showDoctor: boolean; onApproved: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <div className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href={detailHref} className="min-w-0 hover:underline">
          <p className="truncate text-sm font-semibold text-text">{item.patientName}</p>
          <p className="mt-0.5 truncate text-xs text-text-muted">{item.orderNo}{showDoctor && item.doctorName ? ` · ${item.doctorName}` : ''} · {waitingLabel(item.updatedAt)}</p>
        </Link>
        <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-card bg-text px-4 text-xs font-semibold text-white transition-colors hover:bg-neutral-700 sm:h-9">
          View &amp; Approve<MorphIcon icon={ChevronDown} className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && <div className="border-t border-border bg-bg p-2 sm:p-3"><IDesignPlanReviewPanel caseId={item.id} onApproved={onApproved} /></div>}
    </div>
  )
}

function WearRow({ item, href }: { item: PartnerWearItem; href: string }) {
  const percent = Math.min(100, Math.round(item.currentStage / Math.max(1, item.totalSteps) * 100))
  const label = item.daysToNextChange === null ? `Final stage · ends ${shortDate(item.finishDate)}` : item.daysToNextChange <= 0 ? 'Change aligners today' : `Next change in ${item.daysToNextChange} ${item.daysToNextChange === 1 ? 'day' : 'days'}`
  return (
    <li>
      <Link href={href} className="block rounded-card px-3 py-3 transition-colors hover:bg-bg">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-semibold text-text">{item.patientName}</p>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-text">Stage {item.currentStage}<span className="text-text-muted">/{item.totalSteps}</span></span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg"><div className={`h-full rounded-full ${item.dueSoon ? 'bg-primary' : 'bg-text'}`} style={{ width: `${percent}%` }} /></div>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
          <span className={item.dueSoon ? 'font-semibold text-primary' : 'text-text-muted'}>{label}</span>
          <span className="shrink-0 text-text-muted">Finish {shortDate(item.finishDate)}</span>
        </div>
      </Link>
    </li>
  )
}

// ---------- Dental Lab tab ----------

function LabStatusPill({ status }: { status: string }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${ORDER_STATUS_STYLES[status] ?? 'border-border bg-bg text-text'}`}>{ORDER_STATUS_LABELS[status] ?? status}</span>
}

function LabTab({ data, loading, paths }: { data: LabPayload | null; loading: boolean; paths: PartnerOverviewPaths }) {
  const lab = data?.lab
  const totals = lab?.metrics.totals
  const counts = lab?.metrics.statusCounts ?? {}
  const statusSegments = ORDER_STATUS_OPTIONS.map((status) => ({ key: status.value, label: status.label, count: counts[status.value] ?? 0, color: ORDER_STATUS_CHART_COLORS[status.value] }))
  const productMax = Math.max(1, ...(lab?.productMix ?? []).map((item) => item.count))
  const isPortal = data?.role === 'portal'
  const attention = (lab?.newMessages.length ?? 0) + (lab?.redo.length ?? 0) + (lab?.drafts.length ?? 0)
  const ordersHref = (query = '') => `${paths.labOrders}${query}`

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="In progress" value={totals?.active ?? 0} hint={`${totals?.all ?? 0} orders in total`} icon={Package} href={ordersHref()} loading={loading} />
        <KpiCard label="In production" value={counts.in_production ?? 0} hint={`${counts.lab_designing ?? 0} in design`} icon={Factory} href={ordersHref('?status=in_production')} loading={loading} />
        <KpiCard label="On the way" value={lab?.inTransitCount ?? 0} hint={`${counts.delivered ?? 0} delivered`} icon={Truck} href={ordersHref('?status=shipped')} loading={loading} />
        <KpiCard label="Overdue" value={totals?.overdue ?? 0} hint={totals?.overdue ? 'Taking longer than expected' : 'Everything on track'} icon={TriangleAlert} href={ordersHref('?status=overdue')} accent={Boolean(totals?.overdue)} loading={loading} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Needs your attention" subtitle={loading ? 'Loading…' : attention ? 'Messages, re-dos and unfinished drafts' : 'You are all caught up'} icon={Inbox} action={<CountBadge value={attention} tone="primary" />}>
          {loading ? <ListSkeleton rows={4} /> : attention === 0 ? <EmptyState icon={CircleCheck} title="All caught up" body="New lab messages and re-dos will appear here." /> : (
            <div className="space-y-5">
              {lab!.newMessages.length > 0 && (
                <AttentionGroup title="New messages from the lab" count={lab!.newMessages.length} tone="primary">
                  {lab!.newMessages.map((message) => <RowLink key={message.orderId} href={`${paths.labOrders}/${message.orderId}?messages=open`} title={message.patientName} subtitle={<>{message.orderNo} · {relativeDate(message.latestMessageAt)}</>} trailing={<span className="h-2 w-2 rounded-full bg-red-500" aria-label="Unread" />} />)}
                </AttentionGroup>
              )}
              {lab!.redo.length > 0 && (
                <AttentionGroup title="Re-do orders" count={counts.redo ?? lab!.redo.length}>
                  {lab!.redo.map((order) => <RowLink key={order.id} href={`${paths.labOrders}/${order.id}`} title={order.patientName} subtitle={<>{order.orderNo}{order.treatmentType ? ` · ${order.treatmentType}` : ''}</>} trailing={<LabStatusPill status={order.status} />} />)}
                </AttentionGroup>
              )}
              {isPortal && lab!.drafts.length > 0 && (
                <AttentionGroup title="Unfinished drafts" count={lab!.drafts.length}>
                  {lab!.drafts.map((draft) => <RowLink key={draft.id} href={`/portal/drafts/${draft.id}`} title={draft.patientName} subtitle={<>Saved {relativeDate(draft.updatedAt).toLowerCase()}</>} trailing={<span className="hidden text-xs font-semibold text-primary sm:inline">Continue</span>} />)}
                </AttentionGroup>
              )}
            </div>
          )}
        </Panel>

        <Panel title="On the way" subtitle="Shipped and not yet delivered" icon={Truck} action={<ViewAll href={ordersHref('?status=shipped')} />}>
          {loading ? <ListSkeleton rows={3} /> : lab!.inTransit.length === 0 ? <EmptyState icon={PackageCheck} title="Nothing in transit" body="Shipped orders show up here until delivery." /> : (
            <ul className="space-y-1">
              {lab!.inTransit.map((order) => (
                <li key={order.id}>
                  <RowLink href={`${paths.labOrders}/${order.id}`} title={order.patientName} subtitle={<>{order.orderNo}{order.treatmentType ? ` · ${order.treatmentType}` : ''}</>} trailing={<span className="text-[11px] text-text-muted">Shipped {shortDate(order.statusUpdatedAt)}</span>} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Order status" subtitle={`${totals?.all ?? 0} orders by current status`} icon={Layers} action={<ViewAll href={ordersHref()} />}>
          <StackedDistribution segments={statusSegments} total={totals?.all ?? 0} loading={loading} hrefFor={(key) => ordersHref(`?status=${key}`)} />
        </Panel>
        <Panel title="Products" subtitle="Order mix by treatment type" icon={Package}>
          {loading ? <ListSkeleton rows={3} /> : lab!.productMix.length === 0 ? <EmptyState icon={Package} title="No orders yet" body="Your product mix will appear after your first order." /> : (
            <ul className="space-y-3">
              {lab!.productMix.map((item) => (
                <li key={item.label}>
                  <div className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate font-medium text-text">{item.label}</span><span className="shrink-0 font-semibold tabular-nums text-text">{item.count}</span></div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full bg-text" style={{ width: `${item.count / productMax * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Order volume" subtitle="Submitted orders per month · last 6 months" icon={ChartColumn}>
        <TrendBars points={lab?.metrics.trend ?? []} loading={loading} unit="orders" />
      </Panel>
    </div>
  )
}

// ---------- Sales: my doctors ----------

function DoctorTable({ doctors, onSelect }: { doctors: DoctorSummary[]; onSelect: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false)
  const visible = useMemo(() => (expanded ? doctors : doctors.slice(0, 6)), [doctors, expanded])
  return (
    <Panel title="My doctors" subtitle="Workload per doctor · tap one to focus the overview" icon={Users} action={<CountBadge value={doctors.length} />}>
      <div className="hidden overflow-hidden rounded-card border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-bg text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            <tr><th className="px-4 py-2.5">Doctor</th><th className="px-4 py-2.5 text-right">Active aligner cases</th><th className="px-4 py-2.5 text-right">Awaiting approval</th><th className="px-4 py-2.5 text-right">Active lab orders</th><th className="w-10" /></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((doctor) => (
              <tr key={doctor.id} onClick={() => onSelect(doctor.id)} className="cursor-pointer transition-colors hover:bg-bg">
                <td className="px-4 py-3 font-semibold text-text">{doctor.name}</td>
                <td className="px-4 py-3 text-right tabular-nums">{doctor.activeAligners}</td>
                <td className="px-4 py-3 text-right">{doctor.awaitingApproval ? <span className="inline-grid h-6 min-w-6 place-items-center rounded-full bg-primary px-2 text-xs font-semibold text-white">{doctor.awaitingApproval}</span> : <span className="text-text-muted">0</span>}</td>
                <td className="px-4 py-3 text-right tabular-nums">{doctor.activeLabOrders}</td>
                <td className="px-2 py-3 text-text-muted"><MorphIcon icon={ChevronRight} className="h-4 w-4" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {visible.map((doctor) => (
          <li key={doctor.id}>
            <button type="button" onClick={() => onSelect(doctor.id)} className="w-full rounded-card border border-border p-3 text-left transition-colors active:bg-bg">
              <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-text">{doctor.name}</p>{doctor.awaitingApproval > 0 && <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">{doctor.awaitingApproval} to approve</span>}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded bg-bg px-2.5 py-2"><p className="text-text-muted">Aligner cases</p><p className="mt-0.5 text-base font-semibold tabular-nums text-text">{doctor.activeAligners}</p></div>
                <div className="rounded bg-bg px-2.5 py-2"><p className="text-text-muted">Lab orders</p><p className="mt-0.5 text-base font-semibold tabular-nums text-text">{doctor.activeLabOrders}</p></div>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {doctors.length > 6 && <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-3 h-10 w-full rounded-card border border-border text-xs font-semibold text-text transition-colors hover:bg-bg">{expanded ? 'Show fewer' : `Show all ${doctors.length} doctors`}</button>}
    </Panel>
  )
}

