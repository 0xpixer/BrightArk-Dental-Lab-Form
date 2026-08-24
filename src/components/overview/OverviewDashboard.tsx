'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock3, ClockAlert, Factory, PackageSearch, RefreshCw, RotateCcw, Truck } from 'lucide-react'
import {
  ORDER_STATUS_CHART_COLORS,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_OPTIONS,
} from '@/lib/orderStatus'
import type { OverviewGranularity, OverviewTrendPoint } from '@/lib/overviewMetrics'

interface OverviewData {
  metrics: {
    totals: { all: number; active: number; completed: number; overdue: number }
    statusCounts: Record<string, number>
    trend: OverviewTrendPoint[]
    periodLabel: string
  }
  scopeLabel: string
  canFilterDoctors: boolean
  selectedDoctorId: number | null
  doctors: Array<{ id: number; name: string }>
  generatedAt: string
}

export function OverviewDashboard() {
  const [granularity, setGranularity] = useState<OverviewGranularity>('month')
  const [doctorId, setDoctorId] = useState('all')
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ granularity })
      if (doctorId !== 'all') params.set('doctorId', doctorId)
      const response = await fetch(`/api/overview?${params}`)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Unable to load overview')
      setData(payload)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load overview')
    } finally {
      setLoading(false)
    }
  }, [doctorId, granularity])

  useEffect(() => {
    load()
  }, [load])

  const statusSegments = useMemo(() => {
    const total = data?.metrics.totals.all ?? 0
    let offset = 0
    return ORDER_STATUS_OPTIONS.map((status) => {
      const count = data?.metrics.statusCounts[status.value] ?? 0
      const fraction = total > 0 ? count / total : 0
      const segment = { ...status, count, fraction, offset }
      offset += fraction
      return segment
    })
  }, [data])

  const maxTrend = Math.max(1, ...(data?.metrics.trend.map((point) => point.count) ?? [1]))
  const totals = data?.metrics.totals
  const statusCounts = data?.metrics.statusCounts
  const hoveredSegment = statusSegments.find((segment) => segment.value === hoveredStatus)

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Overview</h1>
          <p className="mt-1 text-sm text-text-muted">{data?.scopeLabel ?? 'Order performance and current workload'}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {data?.canFilterDoctors && (
            <label className="flex items-center gap-2 text-xs font-medium text-text-muted">
              Doctor
              <select
                value={doctorId}
                onChange={(event) => setDoctorId(event.target.value)}
                className="min-w-48 rounded-card border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10"
              >
                <option value="all">All doctors</option>
                {data.doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 rounded-card border border-border bg-surface p-1" aria-label="Order volume interval">
            {(['week', 'month'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setGranularity(option)}
                aria-pressed={granularity === option}
                className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors ${granularity === option ? 'bg-text text-white' : 'text-text-muted hover:text-text'}`}
              >
                {option === 'week' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={load} className="rounded p-1.5 hover:bg-red-100" title="Retry"><RefreshCw className="h-4 w-4" /><span className="sr-only">Retry</span></button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="All Orders" value={totals?.all} icon={PackageSearch} loading={loading} />
        <MetricCard label="Overdue" value={totals?.overdue} icon={ClockAlert} loading={loading} />
        <MetricCard label="Pending" value={statusCounts?.pending} icon={Clock3} loading={loading} />
        <MetricCard label="In Production" value={statusCounts?.in_production} icon={Factory} loading={loading} />
        <SplitMetricCard
          label="Shipped / Delivered"
          first={{ label: 'Shipped', value: statusCounts?.shipped }}
          second={{ label: 'Delivered', value: statusCounts?.delivered }}
          icon={Truck}
          loading={loading}
        />
        <MetricCard label="Re-Do" value={statusCounts?.redo} icon={RotateCcw} loading={loading} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <section className="rounded-card border border-border bg-surface p-4 sm:p-5">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-text">Order Status</h2>
            <p className="mt-1 text-xs text-text-muted">Current status across all matching orders</p>
          </div>
          <div className="grid items-center gap-6 sm:grid-cols-[180px_1fr] xl:grid-cols-1 2xl:grid-cols-[180px_1fr]">
            <div className="relative mx-auto aspect-square w-44" role="group" aria-label="Interactive order status distribution">
              <svg viewBox="0 0 176 176" className="h-full w-full -rotate-90" aria-hidden="false">
                <circle cx="88" cy="88" r="70" fill="none" stroke="#e5e5e5" strokeWidth="24" />
                {statusSegments.map((segment) => segment.count > 0 && (
                  <g key={segment.value}>
                    <circle
                      cx="88"
                      cy="88"
                      r="70"
                      fill="none"
                      stroke={ORDER_STATUS_CHART_COLORS[segment.value]}
                      strokeWidth={hoveredStatus === segment.value ? 28 : 24}
                      strokeDasharray={`${segment.fraction * DONUT_CIRCUMFERENCE} ${DONUT_CIRCUMFERENCE}`}
                      strokeDashoffset={-segment.offset * DONUT_CIRCUMFERENCE}
                      className="cursor-pointer outline-none transition-[stroke-width,opacity] duration-150 focus:opacity-80"
                      tabIndex={0}
                      role="img"
                      aria-label={`${segment.label}: ${segment.count} orders, ${Math.round(segment.fraction * 100)} percent`}
                      onMouseEnter={() => setHoveredStatus(segment.value)}
                      onMouseLeave={() => setHoveredStatus(null)}
                      onFocus={() => setHoveredStatus(segment.value)}
                      onBlur={() => setHoveredStatus(null)}
                    />
                  </g>
                ))}
              </svg>
              <div className="pointer-events-none absolute inset-7 grid place-items-center rounded-full bg-surface text-center">
                <div className="max-w-24">
                  <p className={`${hoveredSegment ? 'text-lg' : 'text-2xl'} font-semibold tabular-nums text-text`}>{loading ? '—' : hoveredSegment?.count ?? totals?.all ?? 0}</p>
                  <p className="truncate text-[11px] font-medium text-text-muted">{hoveredSegment?.label ?? 'orders'}</p>
                  {hoveredSegment && <p className="text-[10px] text-text-muted">{Math.round(hoveredSegment.fraction * 100)}%</p>}
                </div>
              </div>
            </div>
            <div className="space-y-2.5">
              {ORDER_STATUS_OPTIONS.map((status) => {
                const count = data?.metrics.statusCounts[status.value] ?? 0
                const percentage = totals?.all ? Math.round(count / totals.all * 100) : 0
                return (
                  <div key={status.value} className="grid grid-cols-[10px_1fr_auto] items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ORDER_STATUS_CHART_COLORS[status.value] }} />
                    <span className="truncate text-text-muted">{ORDER_STATUS_LABELS[status.value]}</span>
                    <span className="font-semibold tabular-nums text-text">{loading ? '—' : `${count} · ${percentage}%`}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="rounded-card border border-border bg-surface p-4 sm:p-5">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div><h2 className="text-sm font-semibold text-text">Order Volume</h2><p className="mt-1 text-xs text-text-muted">{data?.metrics.periodLabel ?? (granularity === 'week' ? 'Last 8 weeks' : 'Last 6 months')}</p></div>
            <p className="text-xs text-text-muted">Submitted orders</p>
          </div>
          <div className="relative h-64 border-b border-l border-border pl-2" role="img" aria-label={`${granularity === 'week' ? 'Weekly' : 'Monthly'} submitted order volume`}>
            <div className="pointer-events-none absolute inset-x-2 inset-y-0 flex flex-col justify-between">
              {[1, 2, 3, 4].map((line) => <span key={line} className="border-t border-dashed border-border/70" />)}
            </div>
            <div className="relative flex h-full items-end justify-around gap-2 px-1">
              {loading
                ? Array.from({ length: granularity === 'week' ? 8 : 6 }, (_, index) => (
                    <div key={index} className="h-2/3 min-w-0 flex-1 animate-pulse rounded-t bg-border" />
                  ))
                : (data?.metrics.trend ?? []).map((point) => (
                    <div key={point.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                      <span className="text-[10px] font-semibold tabular-nums text-text-muted">{point.count}</span>
                      <div className="flex h-[calc(100%-38px)] w-full items-end justify-center">
                        <div
                          className="w-full max-w-12 rounded-t bg-text transition-[height] duration-300"
                          style={{ height: point.count > 0 ? `${Math.max(7, point.count / maxTrend * 100)}%` : '2px', opacity: point.count > 0 ? 1 : 0.22 }}
                          title={`${point.label}: ${point.count} orders`}
                        />
                      </div>
                      <span className="h-4 max-w-full truncate text-[10px] text-text-muted">{point.label}</span>
                    </div>
                  ))}
            </div>
          </div>
        </section>
      </div>

      {data && <p className="text-right text-[11px] text-text-muted">Updated {new Date(data.generatedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
    </div>
  )
}

const DONUT_CIRCUMFERENCE = 2 * Math.PI * 70

function MetricCard({ label, value, icon: Icon, loading }: { label: string; value?: number; icon: typeof PackageSearch; loading: boolean }) {
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <div className="mb-3 grid h-8 w-8 place-items-center rounded bg-bg text-text"><Icon className="h-4 w-4" aria-hidden /></div>
      <p className="text-xs font-medium text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-text">{loading ? '—' : value ?? 0}</p>
    </section>
  )
}

function SplitMetricCard({ label, first, second, icon: Icon, loading }: {
  label: string
  first: { label: string; value?: number }
  second: { label: string; value?: number }
  icon: typeof PackageSearch
  loading: boolean
}) {
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <div className="mb-3 grid h-8 w-8 place-items-center rounded bg-bg text-text"><Icon className="h-4 w-4" aria-hidden /></div>
      <p className="truncate text-xs font-medium text-text-muted">{label}</p>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {[first, second].map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="text-xl font-semibold tabular-nums text-text">{loading ? '—' : item.value ?? 0}</p>
            <p className="truncate text-[10px] text-text-muted">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
