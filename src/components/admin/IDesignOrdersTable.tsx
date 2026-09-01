'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import {
  IDESIGN_CATEGORIES,
  IDESIGN_COUNTRIES,
  IDESIGN_PROGRESS_OPTIONS,
  IDESIGN_PROGRESS_STYLES,
} from '@/lib/idesign/orders'

interface IDesignOrderRow {
  id: number
  patientName: string
  caseId: string | null
  doctorName: string
  salespersonName: string
  country: string
  category: string
  latestProgress: string
  purchasedProducts: string | null
  sourceCreatedOn: string | null
  originalCurrency: string | null
  totalAmount: string | null
  paymentStatus: string
}

export function IDesignOrdersTable({ initialProgress = '' }: { initialProgress?: string }) {
  const [orders, setOrders] = useState<IDesignOrderRow[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [progress, setProgress] = useState(initialProgress)
  const [country, setCountry] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      if (category) params.set('category', category)
      if (progress) params.set('progress', progress)
      if (country) params.set('country', country)
      const response = await fetch(`/api/admin/idesign/orders?${params}`, { cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error ?? 'Unable to load iDesign orders')
      setOrders(payload.orders)
      setTotal(payload.pagination.total)
      setTotalPages(payload.pagination.totalPages)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load iDesign orders')
    } finally {
      setLoading(false)
    }
  }, [category, country, page, progress, search])

  useEffect(() => {
    const timeout = setTimeout(load, search ? 250 : 0)
    return () => clearTimeout(timeout)
  }, [load, search])

  const updateFilter = (setter: (value: string) => void, value: string) => {
    setter(value)
    setPage(1)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">iDesign Orders</h1>
          <p className="mt-1 text-sm text-text-muted">{loading ? 'Loading records...' : `${total} records across aligners, scanners, and other products`}</p>
        </div>
        <Link href="/admin/idesign/orders/new" className="inline-flex h-10 items-center justify-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-primary/30">
          <Plus className="h-4 w-4" aria-hidden /> Add Record
        </Link>
      </header>

      <section className="rounded-card border border-border bg-surface p-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_180px_220px_160px]">
          <label className="relative">
            <span className="sr-only">Search iDesign orders</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-muted" aria-hidden />
            <input type="search" value={search} onChange={(event) => updateFilter(setSearch, event.target.value)} placeholder="Search patient, case, doctor or sales" className="h-10 w-full rounded-card border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-text focus:ring-2 focus:ring-text/10" />
          </label>
          <FilterSelect label="Category" value={category} onChange={(value) => updateFilter(setCategory, value)} options={IDESIGN_CATEGORIES} />
          <FilterSelect label="Progress" value={progress} onChange={(value) => updateFilter(setProgress, value)} options={IDESIGN_PROGRESS_OPTIONS} />
          <FilterSelect label="Country" value={country} onChange={(value) => updateFilter(setCountry, value)} options={IDESIGN_COUNTRIES} />
        </div>
      </section>

      {error && <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="overflow-hidden rounded-card border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px]">
            <thead className="border-b border-border bg-bg text-left text-xs font-semibold uppercase text-text-muted">
              <tr>
                <th className="px-4 py-3">Patient / Case</th>
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3">Sales</th>
                <th className="px-4 py-3">Market</th>
                <th className="px-4 py-3">Category / Product</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Payment</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-text-muted">Loading iDesign orders...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-text-muted">No matching records</td></tr>
              ) : orders.map((order) => (
                <tr key={order.id} className="border-b border-border last:border-0 hover:bg-bg/60">
                  <td className="px-4 py-3"><p className="text-sm font-medium text-text">{order.patientName}</p><p className="mt-0.5 text-xs text-text-muted">{order.caseId || 'No case ID'}</p></td>
                  <td className="px-4 py-3 text-sm text-text">{order.doctorName}</td>
                  <td className="px-4 py-3 text-sm text-text">{order.salespersonName}</td>
                  <td className="px-4 py-3 text-sm text-text-muted">{order.country}</td>
                  <td className="max-w-64 px-4 py-3"><p className="text-sm font-medium text-text">{order.category}</p><p className="mt-0.5 truncate text-xs text-text-muted" title={order.purchasedProducts ?? ''}>{order.purchasedProducts || 'No product recorded'}</p></td>
                  <td className="px-4 py-3"><span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${IDESIGN_PROGRESS_STYLES[order.latestProgress] ?? 'border-border bg-bg text-text-muted'}`}>{order.latestProgress}</span></td>
                  <td className="px-4 py-3 text-sm text-text-muted">{formatDate(order.sourceCreatedOn)}</td>
                  <td className="px-4 py-3"><p className="text-sm text-text">{order.paymentStatus}</p><p className="mt-0.5 text-xs text-text-muted">{formatAmount(order.totalAmount, order.originalCurrency)}</p></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between border-t border-border px-4 py-3">
          <p className="text-xs text-text-muted">Page {page} of {totalPages}</p>
          <div className="flex gap-1">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} className="grid h-8 w-8 place-items-center rounded border border-border text-text-muted hover:bg-bg disabled:opacity-40" title="Previous page"><ChevronLeft className="h-4 w-4" /><span className="sr-only">Previous page</span></button>
            <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || loading} className="grid h-8 w-8 place-items-center rounded border border-border text-text-muted hover:bg-bg disabled:opacity-40" title="Next page"><ChevronRight className="h-4 w-4" /><span className="sr-only">Next page</span></button>
          </div>
        </footer>
      </section>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[] }) {
  return <label><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-card border border-border bg-surface px-3 text-sm text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10"><option value="">All {label.toLowerCase()}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })
}

function formatAmount(value: string | null, currency: string | null) {
  if (!value) return 'Amount not recorded'
  const numeric = Number(value.replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(numeric)) return [currency, value].filter(Boolean).join(' ')
  return `${currency ? `${currency} ` : ''}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(numeric)}`
}
