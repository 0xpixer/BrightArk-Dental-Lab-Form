'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { IDESIGN_PROGRESS_STYLES } from '@/lib/idesign/orders'

interface CaseRow {
  id: number
  orderNo: string
  patientName: string
  gender: string
  dateOfBirth: string
  latestProgress: string
  createdAt: string
  createdByName: string | null
  doctorName: string | null
  salesName: string | null
}

export function IDesignCasesTable() {
  const pathname = usePathname()
  const newHref = pathname.startsWith('/portal') ? '/portal/idesign/orders/new' : '/admin/idesign/orders/new'
  const [cases, setCases] = useState<CaseRow[]>([])
  const [search, setSearch] = useState('')
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
      const response = await fetch(`/api/idesign/cases?${params}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Unable to load clear aligner orders')
      setCases(payload.cases)
      setTotal(payload.pagination.total)
      setTotalPages(payload.pagination.totalPages)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load clear aligner orders')
    } finally { setLoading(false) }
  }, [page, search])

  useEffect(() => { const timer = setTimeout(load, search ? 250 : 0); return () => clearTimeout(timer) }, [load, search])

  return <section className="space-y-4">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-xl font-semibold text-text">iDesign | Clear Aligners</h1><p className="mt-1 text-sm text-text-muted">{loading ? 'Loading orders...' : `${total} clear aligner order${total === 1 ? '' : 's'}`}</p></div><Link href={newHref} className="inline-flex h-10 items-center justify-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-orange-600"><Plus className="h-4 w-4" />New Order</Link></header>
    <div className="rounded-card border border-border bg-surface p-3"><label className="relative block max-w-md"><span className="sr-only">Search clear aligner orders</span><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-muted" /><input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search patient or order number" className="h-10 w-full rounded-card border border-border bg-surface pl-9 pr-3 text-sm outline-none focus:border-text focus:ring-2 focus:ring-text/10" /></label></div>
    {error && <div role="alert" className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="overflow-hidden rounded-card border border-border bg-surface"><div className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold text-text">Clinical Cases</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[820px]"><thead className="border-b border-border bg-bg text-left text-xs font-semibold uppercase text-text-muted"><tr><th className="px-4 py-3">Order</th><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Date of birth</th><th className="px-4 py-3">Submitted by</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th></tr></thead><tbody>{loading ? <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-text-muted">Loading orders...</td></tr> : cases.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-text-muted">No clear aligner orders yet</td></tr> : cases.map((item) => <tr key={item.id} className="border-b border-border last:border-0 hover:bg-bg/60"><td className="px-4 py-3 text-sm font-medium text-text">{item.orderNo}</td><td className="px-4 py-3"><p className="text-sm font-medium text-text">{item.patientName}</p><p className="text-xs text-text-muted">{item.gender}</p></td><td className="px-4 py-3 text-sm text-text-muted">{formatDate(item.dateOfBirth)}</td><td className="px-4 py-3"><p className="text-sm text-text">{item.doctorName || item.salesName || item.createdByName || 'Account unavailable'}</p></td><td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${IDESIGN_PROGRESS_STYLES[item.latestProgress] ?? 'border-border bg-bg text-text-muted'}`}>{item.latestProgress}</span></td><td className="px-4 py-3 text-sm text-text-muted">{formatDate(item.createdAt)}</td></tr>)}</tbody></table></div><footer className="flex items-center justify-between border-t border-border px-4 py-3"><p className="text-xs text-text-muted">Page {page} of {totalPages}</p><div className="flex gap-1"><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading} className="grid h-8 w-8 place-items-center rounded border border-border text-text-muted hover:bg-bg disabled:opacity-40" title="Previous page"><ChevronLeft className="h-4 w-4" /></button><button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages || loading} className="grid h-8 w-8 place-items-center rounded border border-border text-text-muted hover:bg-bg disabled:opacity-40" title="Next page"><ChevronRight className="h-4 w-4" /></button></div></footer></div>
  </section>
}

function formatDate(value: string) { const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value); return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) }
