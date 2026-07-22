'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, Link2, Eye, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { ShareLinkModal } from './ShareLinkModal'

interface OrderRow {
  id: number
  orderNo: string
  dentist: string
  patientName: string
  status: string
  createdAt: string
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'complete', label: 'Complete' },
] as const

const STATUS_SELECT_CLASS: Record<string, string> = {
  pending: 'border-yellow-200 bg-yellow-100 text-yellow-800',
  in_progress: 'border-blue-200 bg-blue-100 text-blue-800',
  complete: 'border-green-200 bg-green-100 text-green-800',
}

export function SubmissionsTable({ canUpdateStatus, canDelete }: { canUpdateStatus: boolean; canDelete: boolean }) {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [shareOrderId, setShareOrderId] = useState<number | null>(null)
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null)
  const [deletingOrderId, setDeletingOrderId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: String(page),
      limit: '20',
      sortBy,
      sortDir,
    })
    if (status !== 'all') params.set('status', status)
    if (search) params.set('search', search)

    const res = await fetch(`/api/admin/orders?${params}`)
    const data = await res.json()
    setOrders(data.orders ?? [])
    setTotalPages(data.pagination?.totalPages ?? 1)
    setLoading(false)
  }, [page, status, search, sortBy, sortDir])

  useEffect(() => {
    const t = setTimeout(fetchOrders, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchOrders, search])

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
    setPage(1)
  }

  const updateOrderStatus = async (orderId: number, nextStatus: string) => {
    if (!canUpdateStatus) return
    const previousOrders = orders
    setActionError(null)
    setUpdatingOrderId(orderId)
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, status: nextStatus } : order,
      ),
    )

    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to update status')
    } catch (error) {
      setOrders(previousOrders)
      setActionError(error instanceof Error ? error.message : 'Failed to update status')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  const deleteOrder = async (order: OrderRow) => {
    if (!canDelete) return
    if (!confirm(`Delete order ${order.orderNo}? This cannot be undone.`)) return

    setActionError(null)
    setDeletingOrderId(order.id)

    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => null) as { error?: string } | null
      if (!res.ok || data?.error) throw new Error(data?.error ?? 'Failed to delete order')

      setOrders((current) => current.filter((row) => row.id !== order.id))
      if (orders.length === 1 && page > 1) {
        setPage((current) => current - 1)
      } else {
        fetchOrders()
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to delete order')
    } finally {
      setDeletingOrderId(null)
    }
  }

  const downloadZip = (id: number, orderNo: string) => {
    window.location.href = `/api/admin/orders/${id}/download`
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const SortHeader = ({ col, label }: { col: string; label: string }) => (
    <th
      className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted hover:text-text"
      onClick={() => toggleSort(col)}
    >
      {label} {sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-text">Submissions</h1>
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            placeholder="Search order, doctor, patient…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="rounded-card border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className="rounded-card border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="complete">Complete</option>
          </select>
        </div>
      </div>

      {actionError && (
        <div role="alert" className="mb-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="border-b border-border bg-bg">
              <tr>
                <SortHeader col="orderNo" label="Order ID" />
                <SortHeader col="dentist" label="Doctor Name" />
                <SortHeader col="patientName" label="Patient Name" />
                <SortHeader col="status" label="Status" />
                <SortHeader col="createdAt" label="Submitted" />
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted">Download</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-text-muted">
                    Loading…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-text-muted">
                    No submissions found
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-0 hover:bg-bg/50">
                    <td className="px-4 py-3 text-sm font-medium text-text">{order.orderNo}</td>
                    <td className="px-4 py-3 text-sm text-text">{order.dentist}</td>
                    <td className="px-4 py-3 text-sm text-text">{order.patientName}</td>
                    <td className="px-4 py-3">
                      {canUpdateStatus ? (
                        <select
                          value={order.status}
                          disabled={updatingOrderId === order.id}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium outline-none transition-opacity focus:ring-2 focus:ring-primary/20 disabled:cursor-wait disabled:opacity-60 ${
                            STATUS_SELECT_CLASS[order.status] ?? 'border-gray-200 bg-gray-100 text-gray-700'
                          }`}
                          aria-label={`Update status for order ${order.orderNo}`}
                          title="Click to update status"
                        >
                          {STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_SELECT_CLASS[order.status] ?? 'border-gray-200 bg-gray-100 text-gray-700'}`}>
                          {STATUS_OPTIONS.find((option) => option.value === order.status)?.label ?? order.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-muted">{formatDate(order.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => downloadZip(order.id, order.orderNo)}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:border-primary hover:text-primary"
                          title="Download ZIP"
                        >
                          <Download className="h-3.5 w-3.5" />
                          ZIP
                        </button>
                        <button
                          type="button"
                          onClick={() => setShareOrderId(order.id)}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:border-accent hover:text-accent"
                          title="Share link"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Link
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Link
                          href={`/admin/submissions/${order.id}`}
                          className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/20"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => deleteOrder(order)}
                            disabled={deletingOrderId === order.id}
                            className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-wait disabled:opacity-60"
                            title="Delete order"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="inline-flex items-center gap-1 rounded border border-border px-3 py-1 text-xs disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <span className="text-xs text-text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="inline-flex items-center gap-1 rounded border border-border px-3 py-1 text-xs disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {shareOrderId !== null && (
        <ShareLinkModal orderId={shareOrderId} onClose={() => setShareOrderId(null)} />
      )}
    </>
  )
}
