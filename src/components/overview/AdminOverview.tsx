'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import type { IconNode } from 'lucide'
import {
  ArrowDownRight,
  ArrowUpRight,
  ChartColumn,
  CircleCheck,
  ClipboardCheck,
  Factory,
  Globe,
  Inbox,
  Layers,
  MessageCircle,
  Package,
  PencilLine,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Target,
  TriangleAlert,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { IDESIGN_PROGRESS_COLORS, IDESIGN_PROGRESS_OPTIONS } from '@/lib/idesign/orders'
import { ORDER_STATUS_CHART_COLORS, ORDER_STATUS_OPTIONS } from '@/lib/orderStatus'
import type { CurrencyAmount, TrendPoint } from '@/lib/overview/partner'
import type { AdminLabQueueItem, AdminQueue, AdminQueueItem } from '@/lib/overview/admin'
import {
  AttentionGroup,
  CountBadge,
  EmptyState,
  formatMoney,
  KpiCard,
  LabStatusPill,
  ListSkeleton,
  Panel,
  ProgressPill,
  relativeDate,
  RowLink,
  StackedDistribution,
  TrendBars,
  ViewAll,
} from './PartnerOverview'

type Tab = 'aligners' | 'lab'

const ALIGNER_LIST = '/admin/idesign/orders'
const LAB_LIST = '/admin/submissions'
const FINANCE = '/admin/finance'

const CATEGORY_COLORS: Record<string, string> = { iAlign: '#171717', iScan: '#f97316', 'Dental Lab': '#06b6d4', Others: '#a3a3a3' }

const ALIGNER_QUEUE_LABELS: Record<string, { title: string; hint: string; tone: 'primary' | 'neutral' }> = {
  design: { title: 'In design for 3+ days', hint: 'Publish a plan', tone: 'primary' },
  approval: { title: 'Awaiting doctor approval 5+ days', hint: 'Sales follow-up', tone: 'primary' },
  production: { title: 'Approved, ready for production', hint: 'Start production', tone: 'neutral' },
  unassigned: { title: 'Missing doctor or sales', hint: 'Assign accounts', tone: 'neutral' },
  entering: { title: 'Case info incomplete 5+ days', hint: 'Chase the clinic', tone: 'neutral' },
}

const LAB_QUEUE_LABELS: Record<string, { title: string; tone: 'primary' | 'neutral' }> = {
  pending: { title: 'Pending 2+ days, not started', tone: 'primary' },
  overdue: { title: 'Overdue in current status', tone: 'primary' },
  redo: { title: 'Re-do orders', tone: 'neutral' },
}

interface FinancePayload {
  counts: { invoiced: number; paid: number; unpaid: number; overdue: number; notInvoiced: number }
  invoiced: CurrencyAmount[]
  paid: CurrencyAmount[]
  unpaid: CurrencyAmount[]
  overdue: CurrencyAmount[]
  overdueDays: number
}

interface Leader { id: number | null; name: string; newThisMonth: number; active: number }

interface BasePayload {
  tab: Tab
  canSeeLab: boolean
  canSeeFinance: boolean
  canManageTargets: boolean
  options: { countries: string[]; sales: Array<{ id: number; name: string }>; doctors: Array<{ id: number; name: string }>; categories: string[] }
  finance: FinancePayload | null
  generatedAt: string
}

interface AlignerPayload extends BasePayload {
  aligners: {
    totals: { all: number; active: number; newThisMonth: number; newLastMonth: number; awaitingApproval: number; inDesign: number }
    pipeline: Record<string, number>
    queues: AdminQueue[]
    categories: string[]
    trend: Array<TrendPoint & { byCategory: Record<string, number> }>
    targets: { totalTarget: number; actual: number; percent: number | null }
    salesLeaderboard: Array<Leader & { id: number; target: number; percent: number | null }>
    doctorLeaderboard: Leader[]
  }
  allTargets: Array<{ id: number; name: string; country: string | null; target: number }>
}

interface LabPayload extends BasePayload {
  lab: {
    metrics: { totals: { all: number; active: number; completed: number; overdue: number }; statusCounts: Record<string, number>; trend: TrendPoint[] }
    productMix: Array<{ label: string; count: number }>
    inTransitCount: number
    queues: Array<{ key: string; count: number; items: AdminLabQueueItem[] }>
    newThisMonth: number
    newLastMonth: number
    doctorLeaderboard: Leader[]
    salesLeaderboard: Leader[]
    newMessages: Array<{ orderId: number; orderNo: string; patientName: string; latestMessageAt: string }>
  }
}

interface Filters { country: string; salesId: string; doctorId: string; category: string }
const EMPTY_FILTERS: Filters = { country: '', salesId: '', doctorId: '', category: '' }

export function AdminOverview({ designer = false }: { designer?: boolean }) {
  const [tab, setTab] = useState<Tab>('aligners')
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [data, setData] = useState<AlignerPayload | LabPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingTargets, setEditingTargets] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!designer && (params.get('tab') === 'lab' || params.get('view') === 'dental-lab')) setTab('lab')
    const country = params.get('country')
    if (country) setFilters((current) => ({ ...current, country }))
  }, [designer])

  const syncUrl = (nextTab: Tab, nextFilters: Filters) => {
    const url = new URL(window.location.href)
    url.searchParams.delete('view')
    if (nextTab === 'lab') url.searchParams.set('tab', 'lab')
    else url.searchParams.delete('tab')
    if (nextFilters.country) url.searchParams.set('country', nextFilters.country)
    else url.searchParams.delete('country')
    window.history.replaceState(null, '', url)
  }

  const selectTab = (next: Tab) => {
    // Doctor and category filters are tab specific, country and sales carry over.
    const nextFilters = { ...filters, doctorId: '', category: '' }
    setTab(next)
    setFilters(nextFilters)
    syncUrl(next, nextFilters)
  }

  const updateFilter = (key: keyof Filters, value: string) => {
    const next = { ...filters, [key]: value }
    if (key === 'country') { next.salesId = ''; next.doctorId = '' }
    if (key === 'salesId') next.doctorId = ''
    setFilters(next)
    syncUrl(tab, next)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ tab })
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
    try {
      const response = await fetch(`/api/admin/overview?${params}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error ?? 'Unable to load the overview')
      setData(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the overview')
    } finally {
      setLoading(false)
    }
  }, [tab, filters])

  useEffect(() => { void load() }, [load])

  const alignerData = data && 'aligners' in data ? data : null
  const labData = data && 'lab' in data ? data : null
  const activeFilters = Object.entries(filters).filter(([key, value]) => value && (tab === 'aligners' || key !== 'category')).length
  const options = data?.options

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 pb-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Operations</p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight text-text sm:text-[28px]">{designer ? 'Design overview' : 'Overview'}{filters.country ? <span className="text-text-muted"> · {filters.country}</span> : ''}</h1>
          <p className="mt-1 text-sm text-text-muted">{designer ? 'Cases waiting on design and approval.' : 'What needs follow-up across BrightArk today.'}</p>
        </div>
        {!designer && (
          <nav className="grid grid-cols-2 rounded-card border border-border bg-surface p-1 sm:inline-grid" aria-label="Overview section">
            {([['aligners', 'Clear Aligners'], ['lab', 'Dental Lab']] as const).map(([value, label]) => (
              <button key={value} type="button" onClick={() => selectTab(value)} aria-pressed={tab === value} className={`h-10 rounded px-5 text-sm font-semibold transition-colors sm:h-9 ${tab === value ? 'bg-text text-white shadow-sm' : 'text-text-muted hover:text-text'}`}>{label}</button>
            ))}
          </nav>
        )}
      </header>

      {/* Filters: always visible on desktop, collapsible on phones */}
      <section className="rounded-card border border-border bg-surface">
        <button type="button" onClick={() => setFiltersOpen((value) => !value)} aria-expanded={filtersOpen} className="flex h-12 w-full items-center justify-between gap-3 px-4 text-sm font-semibold text-text md:hidden">
          <span className="flex items-center gap-2"><MorphIcon icon={SlidersHorizontal} className="h-4 w-4" />Filters{activeFilters ? <span className="rounded-full bg-text px-2 py-0.5 text-[11px] text-white">{activeFilters}</span> : null}</span>
          <span className="text-xs font-medium text-text-muted">{filters.country || 'All countries'}</span>
        </button>
        <div className={`${filtersOpen ? 'grid' : 'hidden'} gap-3 border-t border-border p-4 md:grid md:border-0 ${tab === 'aligners' ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          <FilterSelect icon={Globe} label="Country" value={filters.country} onChange={(value) => updateFilter('country', value)} allLabel="All countries" options={(options?.countries ?? []).map((value) => ({ value, label: value }))} />
          <FilterSelect icon={Users} label="Sales" value={filters.salesId} onChange={(value) => updateFilter('salesId', value)} allLabel="All sales" options={(options?.sales ?? []).map((item) => ({ value: String(item.id), label: item.name }))} />
          <FilterSelect icon={Stethoscope} label="Doctor" value={filters.doctorId} onChange={(value) => updateFilter('doctorId', value)} allLabel="All doctors" options={(options?.doctors ?? []).map((item) => ({ value: String(item.id), label: item.name }))} />
          {tab === 'aligners' && <FilterSelect icon={Layers} label="Category" value={filters.category} onChange={(value) => updateFilter('category', value)} allLabel="All categories" options={(options?.categories ?? []).map((value) => ({ value, label: value }))} />}
          {activeFilters > 0 && <button type="button" onClick={() => { setFilters(EMPTY_FILTERS); syncUrl(tab, EMPTY_FILTERS) }} className="h-10 rounded-card border border-border text-xs font-semibold text-text hover:bg-bg md:col-span-full md:h-8 md:w-fit md:justify-self-end md:px-3">Clear filters</button>}
        </div>
      </section>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="grid h-9 w-9 place-items-center rounded hover:bg-red-100" title="Retry"><MorphIcon icon={RefreshCw} className="h-4 w-4" /><span className="sr-only">Retry</span></button>
        </div>
      )}

      {tab === 'aligners'
        ? <AlignerTab data={alignerData} loading={loading || !alignerData} onEditTargets={() => setEditingTargets(true)} />
        : <LabTab data={labData} loading={loading || !labData} />}

      {data && <p className="text-right text-[11px] text-text-muted">Updated {new Date(data.generatedAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}</p>}

      {editingTargets && alignerData && <TargetsDialog rows={alignerData.allTargets} onClose={() => setEditingTargets(false)} onSaved={async () => { setEditingTargets(false); await load() }} />}
    </div>
  )
}

function FilterSelect({ icon, label, value, onChange, options, allLabel }: { icon: IconNode; label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; allLabel: string }) {
  return (
    <label className="min-w-0">
      <span className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-text-muted"><MorphIcon icon={icon} className="h-3.5 w-3.5" />{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className={`h-11 w-full rounded-card border bg-surface px-3 text-sm outline-none focus:border-text focus:ring-2 focus:ring-text/10 md:h-10 ${value ? 'border-text font-semibold text-text' : 'border-border text-text'}`}>
        <option value="">{allLabel}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function Delta({ current, previous }: { current: number; previous: number }) {
  if (!previous) return <>{previous === 0 && current > 0 ? 'First cases vs last month' : 'Same as last month'}</>
  const change = Math.round((current - previous) / previous * 100)
  if (change === 0) return <>Same as last month ({previous})</>
  return <span className={`inline-flex items-center gap-0.5 ${change > 0 ? 'text-green-700' : 'text-red-600'}`}><MorphIcon icon={change > 0 ? ArrowUpRight : ArrowDownRight} className="h-3 w-3" />{Math.abs(change)}% vs last month ({previous})</span>
}

function Age({ days, warnAt }: { days: number; warnAt: number }) {
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${days >= warnAt * 2 ? 'bg-red-50 text-red-700' : days >= warnAt ? 'bg-[#fff7ed] text-primary' : 'bg-bg text-text-muted'}`}>{days}d</span>
}

function FinanceSnapshot({ finance, loading, title }: { finance: FinancePayload | null; loading: boolean; title: string }) {
  if (!finance && !loading) return null
  const tiles: Array<{ label: string; count?: number; amounts?: CurrencyAmount[]; tone?: 'alert' }> = [
    { label: 'Invoiced', count: finance?.counts.invoiced, amounts: finance?.invoiced },
    { label: 'Paid', count: finance?.counts.paid, amounts: finance?.paid },
    { label: 'Unpaid', count: finance?.counts.unpaid, amounts: finance?.unpaid },
    { label: `Overdue (${finance?.overdueDays ?? 30}+ days)`, count: finance?.counts.overdue, amounts: finance?.overdue, tone: 'alert' },
  ]
  return (
    <Panel title={title} subtitle={finance ? `${finance.counts.notInvoiced} not yet invoiced` : 'Loading…'} icon={Wallet} action={<ViewAll href={FINANCE} label="Finance" />}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => {
          const alert = tile.tone === 'alert' && Boolean(tile.count)
          return (
            <Link key={tile.label} href={tile.tone === 'alert' ? `${FINANCE}?overdue=1` : FINANCE} className={`min-w-0 rounded-card border p-3 transition-colors hover:bg-bg ${alert ? 'border-red-200 bg-red-50' : 'border-border'}`}>
              <p className={`truncate text-[11px] font-medium ${alert ? 'text-red-700' : 'text-text-muted'}`}>{tile.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-text">{loading ? '—' : tile.count ?? 0}</p>
              <div className="mt-1 space-y-0.5">
                {loading ? <span className="block h-3 w-20 animate-pulse rounded bg-border" /> : (tile.amounts ?? []).length === 0 ? <p className="text-[11px] text-text-muted">—</p> : tile.amounts!.map((amount) => <p key={amount.currency} className={`truncate text-[11px] font-medium tabular-nums ${alert ? 'text-red-700' : 'text-text'}`}>{formatMoney(amount)}</p>)}
              </div>
            </Link>
          )
        })}
      </div>
    </Panel>
  )
}

function Leaderboard({ title, subtitle, icon, rows, loading, empty }: { title: string; subtitle: string; icon: IconNode; rows: Leader[]; loading: boolean; empty: string }) {
  const max = Math.max(1, ...rows.map((row) => row.newThisMonth + row.active))
  return (
    <Panel title={title} subtitle={subtitle} icon={icon}>
      {loading ? <ListSkeleton rows={4} /> : rows.length === 0 ? <EmptyState icon={icon} title="No data yet" body={empty} /> : (
        <ol className="space-y-3">
          {rows.map((row, index) => (
            <li key={`${row.id ?? row.name}-${index}`} className="grid grid-cols-[22px_1fr] items-start gap-2">
              <span className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold ${index < 3 ? 'bg-text text-white' : 'bg-bg text-text-muted'}`}>{index + 1}</span>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2 text-xs"><span className="truncate font-semibold text-text">{row.name}</span><span className="shrink-0 tabular-nums text-text-muted"><b className="text-text">{row.newThisMonth}</b> new · {row.active} active</span></div>
                <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-bg">
                  <span className="h-full bg-primary" style={{ width: `${row.newThisMonth / max * 100}%` }} />
                  <span className="h-full bg-text/80" style={{ width: `${row.active / max * 100}%` }} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

function CategoryTrend({ points, categories, loading }: { points: AlignerPayload['aligners']['trend']; categories: string[]; loading: boolean }) {
  const max = Math.max(1, ...points.map((point) => point.count))
  const visible = categories.filter((category) => points.some((point) => point.byCategory[category]))
  return (
    <div>
      <div className="relative h-44 sm:h-52">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-6">{[0, 1, 2, 3].map((line) => <span key={line} className="border-t border-dashed border-border/80" />)}</div>
        <div className="relative flex h-full items-end justify-between gap-2 sm:gap-3">
          {(loading ? Array.from({ length: 6 }, (_, index) => ({ key: String(index), label: '', count: 0, byCategory: {} as Record<string, number> })) : points).map((point) => (
            <div key={point.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
              <div className="flex w-full flex-1 items-end justify-center pt-5">
                <div className={`relative flex w-full max-w-10 flex-col-reverse overflow-visible ${loading ? 'h-1/2 animate-pulse rounded-t-md bg-border' : ''}`} style={loading ? undefined : { height: point.count ? `${Math.max(6, point.count / max * 100)}%` : '3px' }} title={`${point.label}: ${point.count} cases`}>
                  {!loading && visible.map((category) => point.byCategory[category] ? <span key={category} className="w-full first:rounded-b-none last:rounded-t-md" style={{ height: `${point.byCategory[category] / point.count * 100}%`, backgroundColor: CATEGORY_COLORS[category] ?? '#737373' }} /> : null)}
                  {!loading && !point.count && <span className="h-full w-full rounded-t-md bg-text/20" />}
                  {!loading && <span className="absolute inset-x-0 -top-5 text-center text-[11px] font-semibold tabular-nums text-text">{point.count}</span>}
                </div>
              </div>
              <span className="h-4 text-[11px] text-text-muted">{point.label}</span>
            </div>
          ))}
        </div>
      </div>
      {!loading && visible.length > 0 && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">{visible.map((category) => <span key={category} className="flex items-center gap-1.5 text-[11px] text-text-muted"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CATEGORY_COLORS[category] ?? '#737373' }} />{category}</span>)}</div>}
    </div>
  )
}

// ---------- Clear Aligners ----------

function AlignerTab({ data, loading, onEditTargets }: { data: AlignerPayload | null; loading: boolean; onEditTargets: () => void }) {
  const aligners = data?.aligners
  const totals = aligners?.totals
  const queues = (aligners?.queues ?? []).filter((item) => item.count > 0)
  const attention = queues.reduce((sum, item) => sum + item.count, 0)
  const pipelineSegments = IDESIGN_PROGRESS_OPTIONS.map((status) => ({ key: status, label: status, count: aligners?.pipeline[status] ?? 0, color: IDESIGN_PROGRESS_COLORS[status] ?? '#a3a3a3' }))
  const targets = aligners?.targets
  const showTargets = Boolean(data?.canSeeFinance)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Active cases" value={totals?.active ?? 0} hint={`${totals?.inDesign ?? 0} in design · ${totals?.all ?? 0} total`} icon={Layers} href={ALIGNER_LIST} loading={loading} />
        <KpiCard label="New this month" value={totals?.newThisMonth ?? 0} hint={totals ? <Delta current={totals.newThisMonth} previous={totals.newLastMonth} /> : undefined} icon={Sparkles} href={ALIGNER_LIST} loading={loading} />
        <KpiCard label="To approve" value={totals?.awaitingApproval ?? 0} hint="Waiting on doctors" icon={ClipboardCheck} href={`${ALIGNER_LIST}?progress=${encodeURIComponent('Awaiting Approval')}`} loading={loading} />
        {showTargets
          ? <KpiCard label="Monthly target" value={targets?.totalTarget ? <>{targets.actual}<span className="text-base text-text-muted">/{targets.totalTarget}</span></> : targets?.actual ?? 0} hint={targets?.totalTarget ? `${targets.percent}% of target reached` : 'No targets set yet'} icon={Target} href="#sales-targets" accent={Boolean(targets?.percent && targets.percent >= 100)} loading={loading} />
          : <KpiCard label="Ready for production" value={aligners?.pipeline.Approved ?? 0} hint="Approved plans" icon={Factory} href={`${ALIGNER_LIST}?progress=Approved`} loading={loading} />}
      </div>

      <div className={`grid gap-5 ${showTargets ? 'xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]' : ''}`}>
        <Panel title="Needs follow-up" subtitle={loading ? 'Loading…' : attention ? 'Oldest first in each group' : 'Nothing is stuck'} icon={Inbox} action={<CountBadge value={attention} tone="primary" />}>
          {loading ? <ListSkeleton rows={5} /> : attention === 0 ? <EmptyState icon={CircleCheck} title="All on track" body="Cases stuck in design or approval will appear here." /> : (
            <div className="space-y-5">
              {queues.map((group) => {
                const meta = ALIGNER_QUEUE_LABELS[group.key]
                const warnAt = group.key === 'design' ? 3 : group.key === 'production' || group.key === 'unassigned' ? 7 : 5
                return (
                  <AttentionGroup key={group.key} title={meta.title} count={group.count} tone={meta.tone}>
                    {group.items.map((item: AdminQueueItem) => (
                      <RowLink key={item.id} href={`${ALIGNER_LIST}/${item.id}`} title={item.patientName}
                        subtitle={<>{item.orderNo} · {item.doctorName ?? 'No doctor'} · {item.salesName ?? 'No sales'}</>}
                        trailing={<Age days={item.ageDays} warnAt={warnAt} />} />
                    ))}
                    {group.count > group.items.length && <Link href={group.key === 'unassigned' ? ALIGNER_LIST : `${ALIGNER_LIST}?progress=${encodeURIComponent(group.items[0]?.latestProgress ?? '')}`} className="block px-3 py-2.5 text-center text-xs font-semibold text-text-muted hover:bg-bg hover:text-text">+{group.count - group.items.length} more</Link>}
                  </AttentionGroup>
                )
              })}
            </div>
          )}
        </Panel>

        {showTargets && (
          <div id="sales-targets" className="scroll-mt-4">
            <Panel title="Sales targets" subtitle="New aligner cases this month vs target" icon={Target} action={data?.canManageTargets ? <button type="button" onClick={onEditTargets} className="inline-flex h-8 items-center gap-1.5 rounded-card border border-border px-2.5 text-xs font-semibold text-text hover:bg-bg"><MorphIcon icon={PencilLine} className="h-3.5 w-3.5" />Edit</button> : undefined}>
              {loading ? <ListSkeleton rows={4} /> : aligners!.salesLeaderboard.length === 0 ? <EmptyState icon={Target} title="No sales accounts" body="Sales in this country will appear here." /> : (
                <div>
                  {targets?.totalTarget ? (
                    <div className="mb-4 rounded-card bg-bg p-3">
                      <div className="flex items-end justify-between gap-2"><p className="text-xs font-medium text-text-muted">Team total</p><p className="text-sm font-semibold tabular-nums text-text">{targets.actual} / {targets.totalTarget}</p></div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${Math.min(100, targets.percent ?? 0)}%` }} /></div>
                    </div>
                  ) : null}
                  <ul className="space-y-3.5">
                    {aligners!.salesLeaderboard.map((row) => (
                      <li key={row.id}>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate font-semibold text-text">{row.name}</span>
                          <span className="shrink-0 tabular-nums text-text-muted"><b className="text-text">{row.newThisMonth}</b>{row.target ? ` / ${row.target}` : ' · no target'}{row.percent !== null && <span className={`ml-1.5 font-semibold ${row.percent >= 100 ? 'text-green-700' : 'text-text'}`}>{row.percent}%</span>}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg">
                          <div className={`h-full rounded-full ${row.percent !== null && row.percent >= 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: row.target ? `${Math.min(100, row.percent ?? 0)}%` : '0%' }} />
                        </div>
                        <p className="mt-1 text-[11px] text-text-muted">{row.active} active cases</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Case pipeline" subtitle={`${totals?.all ?? 0} cases by current stage · tap to open`} icon={Factory} action={<ViewAll href={ALIGNER_LIST} />}>
          <StackedDistribution segments={pipelineSegments} total={totals?.all ?? 0} loading={loading} hrefFor={(key) => `${ALIGNER_LIST}?progress=${encodeURIComponent(key)}`} />
        </Panel>
        <Panel title="Case volume" subtitle="New cases per month by category" icon={ChartColumn}>
          <CategoryTrend points={aligners?.trend ?? []} categories={aligners?.categories ?? []} loading={loading} />
        </Panel>
      </div>

      {data?.canSeeFinance !== false && <FinanceSnapshot finance={data?.finance ?? null} loading={loading} title="Aligner payments" />}

      <Leaderboard title="Top doctors" subtitle="New cases this month, then active cases" icon={Stethoscope} rows={aligners?.doctorLeaderboard ?? []} loading={loading} empty="Doctors with cases will be ranked here." />
    </div>
  )
}

// ---------- Dental Lab ----------

function LabTab({ data, loading }: { data: LabPayload | null; loading: boolean }) {
  const lab = data?.lab
  const totals = lab?.metrics.totals
  const counts = lab?.metrics.statusCounts ?? {}
  const queues = (lab?.queues ?? []).filter((item) => item.count > 0)
  const attention = queues.reduce((sum, item) => sum + item.count, 0) + (lab?.newMessages.length ?? 0)
  const statusSegments = ORDER_STATUS_OPTIONS.map((status) => ({ key: status.value, label: status.label, count: counts[status.value] ?? 0, color: ORDER_STATUS_CHART_COLORS[status.value] }))
  const productMax = Math.max(1, ...(lab?.productMix ?? []).map((item) => item.count))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="In progress" value={totals?.active ?? 0} hint={`${totals?.all ?? 0} orders in total`} icon={Package} href={LAB_LIST} loading={loading} />
        <KpiCard label="New this month" value={lab?.newThisMonth ?? 0} hint={lab ? <Delta current={lab.newThisMonth} previous={lab.newLastMonth} /> : undefined} icon={Sparkles} href={LAB_LIST} loading={loading} />
        <KpiCard label="In production" value={counts.in_production ?? 0} hint={`${lab?.inTransitCount ?? 0} shipped, on the way`} icon={Truck} href={`${LAB_LIST}?status=in_production`} loading={loading} />
        <KpiCard label="Overdue" value={totals?.overdue ?? 0} hint={totals?.overdue ? 'No status change for 3+ days' : 'Everything on track'} icon={TriangleAlert} href={`${LAB_LIST}?status=overdue`} accent={Boolean(totals?.overdue)} loading={loading} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Needs follow-up" subtitle={loading ? 'Loading…' : attention ? 'Oldest first in each group' : 'Nothing is stuck'} icon={Inbox} action={<CountBadge value={attention} tone="primary" />}>
          {loading ? <ListSkeleton rows={5} /> : attention === 0 ? <EmptyState icon={CircleCheck} title="All on track" body="Stale, overdue and re-do orders will appear here." /> : (
            <div className="space-y-5">
              {lab!.newMessages.length > 0 && (
                <AttentionGroup title="Unread messages from clinics" count={lab!.newMessages.length} tone="primary">
                  {lab!.newMessages.map((message) => <RowLink key={message.orderId} href={`${LAB_LIST}/${message.orderId}?messages=open`} title={message.patientName} subtitle={<>{message.orderNo} · {relativeDate(message.latestMessageAt)}</>} trailing={<MorphIcon icon={MessageCircle} className="h-4 w-4 text-red-500" />} />)}
                </AttentionGroup>
              )}
              {queues.map((group) => (
                <AttentionGroup key={group.key} title={LAB_QUEUE_LABELS[group.key].title} count={group.count} tone={LAB_QUEUE_LABELS[group.key].tone}>
                  {group.items.map((item) => (
                    <RowLink key={item.id} href={`${LAB_LIST}/${item.id}`} title={item.patientName} subtitle={<>{item.orderNo} · {item.doctorName ?? 'Unknown doctor'}</>}
                      trailing={<><span className="hidden sm:inline-flex"><LabStatusPill status={item.status} /></span><Age days={item.ageDays} warnAt={group.key === 'pending' ? 2 : 3} /></>} />
                  ))}
                  {group.count > group.items.length && <Link href={`${LAB_LIST}?status=${group.key === 'overdue' ? 'overdue' : group.key}`} className="block px-3 py-2.5 text-center text-xs font-semibold text-text-muted hover:bg-bg hover:text-text">+{group.count - group.items.length} more</Link>}
                </AttentionGroup>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Order status" subtitle={`${totals?.all ?? 0} orders · tap to open`} icon={Layers} action={<ViewAll href={LAB_LIST} />}>
          <StackedDistribution segments={statusSegments} total={totals?.all ?? 0} loading={loading} hrefFor={(key) => `${LAB_LIST}?status=${key}`} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Order volume" subtitle="Submitted orders per month · last 6 months" icon={ChartColumn}>
          <TrendBars points={lab?.metrics.trend ?? []} loading={loading} unit="orders" />
        </Panel>
        <Panel title="Products" subtitle="Order mix by treatment type" icon={Package}>
          {loading ? <ListSkeleton rows={3} /> : lab!.productMix.length === 0 ? <EmptyState icon={Package} title="No orders yet" body="Product mix appears once orders come in." /> : (
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

      <FinanceSnapshot finance={data?.finance ?? null} loading={loading} title="Dental lab payments" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Leaderboard title="Top doctors" subtitle="New orders this month, then active orders" icon={Stethoscope} rows={lab?.doctorLeaderboard ?? []} loading={loading} empty="Doctors with orders will be ranked here." />
        <Leaderboard title="Sales" subtitle="Orders from each sales rep's doctors" icon={Users} rows={lab?.salesLeaderboard ?? []} loading={loading} empty="Assign doctors to sales to see this." />
      </div>
    </div>
  )
}

// ---------- Targets editor ----------

function TargetsDialog({ rows, onClose, onSaved }: { rows: AlignerPayload['allTargets']; onClose: () => void; onSaved: () => Promise<void> }) {
  const [values, setValues] = useState<Record<number, string>>(() => Object.fromEntries(rows.map((row) => [row.id, row.target ? String(row.target) : ''])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const total = Object.values(values).reduce((sum, value) => sum + (Number(value) || 0), 0)
  const grouped = rows.reduce<Record<string, typeof rows>>((groups, row) => {
    const key = row.country || 'No country'
    groups[key] = [...(groups[key] ?? []), row]
    return groups
  }, {})

  const save = async () => {
    setSaving(true)
    setError(null)
    const targets = rows.map((row) => ({ salesId: row.id, target: Math.max(0, Math.round(Number(values[row.id]) || 0)) }))
    const response = await fetch('/api/admin/overview/targets', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targets }) })
    setSaving(false)
    if (!response.ok) { setError((await response.json().catch(() => ({}))).error ?? 'Unable to save targets'); return }
    await onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="targets-title">
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl bg-surface shadow-xl sm:rounded-card">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div><h2 id="targets-title" className="text-base font-semibold text-text">Monthly sales targets</h2><p className="mt-0.5 text-xs text-text-muted">New clear aligner cases per month. Leave empty for no target.</p></div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-card hover:bg-bg" aria-label="Close"><MorphIcon icon={X} className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {Object.entries(grouped).sort(([left], [right]) => left.localeCompare(right)).map(([country, group]) => (
            <div key={country}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{country}</p>
              <ul className="space-y-2">
                {group.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3">
                    <label htmlFor={`target-${row.id}`} className="min-w-0 truncate text-sm text-text">{row.name}</label>
                    <input id={`target-${row.id}`} type="number" inputMode="numeric" min={0} max={10000} placeholder="—" value={values[row.id] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [row.id]: event.target.value }))} className="h-11 w-24 rounded-card border border-border bg-surface px-3 text-right text-sm tabular-nums outline-none focus:border-text focus:ring-2 focus:ring-text/10 sm:h-10" />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-text-muted">No active sales accounts.</p>}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
          <p className="text-xs text-text-muted">Team total <b className="text-text tabular-nums">{total}</b> cases / month</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-10 rounded-card border border-border px-4 text-sm font-semibold text-text hover:bg-bg">Cancel</button>
            <button type="button" onClick={() => void save()} disabled={saving} className="h-10 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-[#e06d15] disabled:opacity-50">{saving ? 'Saving…' : 'Save targets'}</button>
          </div>
        </div>
        {error && <p role="alert" className="px-5 pb-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}

