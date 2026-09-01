'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Boxes, CheckCircle2, ClipboardEdit, Factory, PackageCheck, RefreshCw, Send, WalletCards } from 'lucide-react'
import {
  IDESIGN_CATEGORIES,
  IDESIGN_PROGRESS_COLORS,
  IDESIGN_PROGRESS_OPTIONS,
} from '@/lib/idesign/orders'
import type { IDesignTrendPoint } from '@/lib/idesign/metrics'

interface AlignerOverviewData {
  metrics: {
    total: number
    newCasesThisMonth: number
    casesLastMonth: number
    paid: number
    unpaid: number
    progressPercent: number
    monthlyGoal: number
    statusCounts: Record<string, number>
    categoryCounts: Record<string, number>
    trend: IDesignTrendPoint[]
  }
  options: { salespeople: string[]; doctors: string[] }
  generatedAt: string
}

export function AlignerOverviewDashboard() {
  const [category, setCategory] = useState('iAlign')
  const [salesperson, setSalesperson] = useState('')
  const [doctor, setDoctor] = useState('')
  const [data, setData] = useState<AlignerOverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ category })
      if (salesperson) params.set('salesperson', salesperson)
      if (doctor) params.set('doctor', doctor)
      const response = await fetch(`/api/admin/idesign/overview?${params}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Unable to load aligner overview')
      setData(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load aligner overview')
    } finally {
      setLoading(false)
    }
  }, [category, doctor, salesperson])

  useEffect(() => { load() }, [load])

  const maxTrend = Math.max(1, ...(data?.metrics.trend.map((point) => point.count) ?? [1]))
  const topStatuses = useMemo(() => IDESIGN_PROGRESS_OPTIONS
    .map((status) => ({ status, count: data?.metrics.statusCounts[status] ?? 0 }))
    .filter((item) => item.count > 0), [data])

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><h1 className="text-xl font-semibold text-text">Aligners Overview</h1><p className="mt-1 text-sm text-text-muted">iDesign order progress, payments, and recent case volume</p></div>
        <div className="grid gap-2 sm:grid-cols-3 xl:w-[680px]">
          <OverviewFilter label="Category" value={category} onChange={setCategory} options={['all', ...IDESIGN_CATEGORIES]} allLabel="All categories" />
          <OverviewFilter label="Sales" value={salesperson} onChange={setSalesperson} options={data?.options.salespeople ?? []} allLabel="All salespeople" />
          <OverviewFilter label="Doctor" value={doctor} onChange={setDoctor} options={data?.options.doctors ?? []} allLabel="All doctors" />
        </div>
      </header>

      {error && <div role="alert" className="flex items-center justify-between rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button type="button" onClick={load} title="Retry" className="rounded p-1.5 hover:bg-red-100"><RefreshCw className="h-4 w-4" /><span className="sr-only">Retry</span></button></div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <OverviewCard label="All Cases" value={data?.metrics.total} icon={Boxes} loading={loading} href="/admin/idesign/orders" />
        <OverviewCard label="Entering Info" value={data?.metrics.statusCounts['Entering Info']} icon={ClipboardEdit} loading={loading} href={progressHref('Entering Info')} />
        <OverviewCard label="Awaiting Review" value={data?.metrics.statusCounts['Awaiting Clin. Review']} icon={Send} loading={loading} href={progressHref('Awaiting Clin. Review')} />
        <OverviewCard label="In Production" value={data?.metrics.statusCounts['In Production']} icon={Factory} loading={loading} href={progressHref('In Production')} />
        <OverviewCard label="Produced" value={data?.metrics.statusCounts.Produced} icon={PackageCheck} loading={loading} href={progressHref('Produced')} />
        <OverviewCard label="Completed" value={data?.metrics.statusCounts.Completed} icon={CheckCircle2} loading={loading} href={progressHref('Completed')} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        <section className="rounded-card border border-border bg-surface p-4 sm:p-5">
          <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-sm font-semibold text-text">Order Activity</h2><p className="mt-1 text-xs text-text-muted">Cases created over the last six months</p></div><p className="text-xs text-text-muted">{data?.metrics.casesLastMonth ?? 0} last month · {data?.metrics.newCasesThisMonth ?? 0} this month</p></div>
          <div className="relative h-64 border-b border-l border-border pl-2" role="img" aria-label="iDesign case volume over the last six months">
            <div className="pointer-events-none absolute inset-x-2 inset-y-0 flex flex-col justify-between">{[1, 2, 3, 4].map((line) => <span key={line} className="border-t border-dashed border-border/70" />)}</div>
            <div className="relative flex h-full items-end justify-around gap-3 px-2">
              {(data?.metrics.trend ?? Array.from({ length: 6 }, (_, index) => ({ key: String(index), label: '', count: 0 }))).map((point) => (
                <div key={point.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[10px] font-semibold tabular-nums text-text-muted">{loading ? '—' : point.count}</span>
                  <div className="flex h-[calc(100%-38px)] w-full items-end justify-center"><div className={`w-full max-w-14 rounded-t ${loading ? 'animate-pulse bg-border' : 'bg-text'}`} style={{ height: loading ? '55%' : point.count > 0 ? `${Math.max(7, point.count / maxTrend * 100)}%` : '2px', opacity: point.count > 0 || loading ? 1 : 0.2 }} title={`${point.label}: ${point.count} cases`} /></div>
                  <span className="h-4 text-[10px] text-text-muted">{point.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-card border border-border bg-surface p-4 sm:p-5">
          <div className="mb-5"><h2 className="text-sm font-semibold text-text">Progress & Payment</h2><p className="mt-1 text-xs text-text-muted">Current workload and commercial status</p></div>
          <div className="grid grid-cols-2 gap-3">
            <SmallMetric label="Paid" value={data?.metrics.paid} icon={WalletCards} loading={loading} />
            <SmallMetric label="Unpaid" value={data?.metrics.unpaid} icon={WalletCards} loading={loading} />
          </div>
          <div className="mt-5 space-y-3">
            {topStatuses.length === 0 && !loading ? <p className="py-8 text-center text-sm text-text-muted">No matching cases</p> : topStatuses.map(({ status, count }) => {
              const percent = data?.metrics.total ? Math.round(count / data.metrics.total * 100) : 0
              return <div key={status}><div className="mb-1 flex items-center justify-between gap-3 text-xs"><span className="truncate text-text-muted">{status}</span><span className="font-semibold tabular-nums text-text">{count}</span></div><div className="h-2 overflow-hidden rounded-full bg-bg"><div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: IDESIGN_PROGRESS_COLORS[status] ?? '#737373' }} /></div></div>
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

function progressHref(progress: string) { return `/admin/idesign/orders?progress=${encodeURIComponent(progress)}` }

function OverviewFilter({ label, value, onChange, options, allLabel }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[]; allLabel: string }) {
  return <label><span className="mb-1 block text-[11px] font-medium text-text-muted">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-card border border-border bg-surface px-3 text-sm text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10">{label !== 'Category' && <option value="">{allLabel}</option>}{options.map((option) => <option key={option} value={option}>{option === 'all' ? allLabel : option}</option>)}</select></label>
}

function OverviewCard({ label, value, icon: Icon, loading, href }: { label: string; value?: number; icon: typeof Boxes; loading: boolean; href: string }) {
  return <Link href={href} className="rounded-card border border-border bg-surface p-4 transition-colors hover:border-neutral-400 hover:bg-bg focus:outline-none focus:ring-2 focus:ring-text/10"><div className="mb-3 grid h-8 w-8 place-items-center rounded bg-bg text-text"><Icon className="h-4 w-4" /></div><p className="truncate text-xs font-medium text-text-muted">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-text">{loading ? '—' : value ?? 0}</p></Link>
}

function SmallMetric({ label, value, icon: Icon, loading }: { label: string; value?: number; icon: typeof WalletCards; loading: boolean }) {
  return <div className="rounded-card border border-border bg-bg p-3"><Icon className="mb-2 h-4 w-4 text-text-muted" /><p className="text-xs text-text-muted">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-text">{loading ? '—' : value ?? 0}</p></div>
}
