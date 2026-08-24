'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, Link2, Eye, ChevronLeft, ChevronRight, FileSpreadsheet, Save, Trash2 } from 'lucide-react'
import { ShareLinkModal } from './ShareLinkModal'
import { isOrderStatusOverdue, ORDER_STATUS_LABELS, ORDER_STATUS_OPTIONS, ORDER_STATUS_STYLES } from '@/lib/orderStatus'
import { ORDER_NOTE_MAX_LENGTH } from '@/lib/orderActivity'

interface OrderRow {
  id: number
  orderNo: string
  dentist: string
  patientName: string
  status: string
  statusUpdatedAt: string
  notes: string | null
  createdAt: string
  hasUnreadMessage: boolean
}

export function SubmissionsTable({ canUpdateStatus, canEditNotes, canDelete, initialStatus = 'all' }: { canUpdateStatus: boolean; canEditNotes: boolean; canDelete: boolean; initialStatus?: string }) {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(initialStatus)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [shareOrderId, setShareOrderId] = useState<number | null>(null)
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null)
  const [deletingOrderId, setDeletingOrderId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({})
  const [savingNoteOrderId, setSavingNoteOrderId] = useState<number | null>(null)

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
        order.id === orderId ? { ...order, status: nextStatus, statusUpdatedAt: new Date().toISOString() } : order,
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
      setOrders((current) => current.map((order) => order.id === orderId
        ? { ...order, statusUpdatedAt: data.order?.statusUpdatedAt ?? order.statusUpdatedAt }
        : order))
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

  const saveNote = async (order: OrderRow) => {
    if (!canEditNotes) return
    const notes = noteDrafts[order.id] ?? order.notes ?? ''
    setActionError(null)
    setSavingNoteOrderId(order.id)
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Failed to save note')
      setOrders((current) => current.map((row) => row.id === order.id ? { ...row, notes: data.order?.notes ?? null } : row))
      setNoteDrafts((current) => {
        const next = { ...current }
        delete next[order.id]
        return next
      })
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to save note')
    } finally {
      setSavingNoteOrderId(null)
    }
  }

  const downloadZip = (id: number, orderNo: string) => {
    window.location.href = `/api/admin/orders/${id}/download`
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const exportSubmissions = () => {
    const params = new URLSearchParams({ sortBy, sortDir })
    if (status !== 'all') params.set('status', status)
    if (search) params.set('search', search)
    window.location.href = `/api/admin/orders/export?${params}`
  }

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
          <button type="button" onClick={exportSubmissions} className="inline-flex items-center gap-2 rounded-card border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100">
            <FileSpreadsheet className="h-4 w-4" /> Export Excel
          </button>
          <input
            type="search"
            placeholder="Search order, doctor, patient…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="rounded-card border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-text focus:ring-2 focus:ring-text/10"
          />
        </div>
      </div>

      {actionError && (
        <div role="alert" className="mb-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px]">
            <thead className="border-b border-border bg-bg">
              <tr>
                <SortHeader col="orderNo" label="Order ID" />
                <SortHeader col="dentist" label="Doctor Name" />
                <SortHeader col="patientName" label="Patient Name" />
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-text-muted">
                  <select
                    value={status}
                    onChange={(event) => {
                      setStatus(event.target.value)
                      setPage(1)
                    }}
                    aria-label="Filter submissions by status"
                    className="w-full min-w-32 rounded border border-border bg-surface px-2 py-1 text-xs font-medium normal-case text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10"
                  >
                    <option value="all">All statuses</option>
                    {ORDER_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    <option value="overdue">Overdue</option>
                  </select>
                </th>
                <SortHeader col="statusUpdatedAt" label="Update Time" />
                <SortHeader col="createdAt" label="Submitted" />
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted">Notes</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted">Download</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-text-muted">
                    Loading…
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-text-muted">
                    No submissions found
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className={`border-b border-border last:border-0 ${isOrderStatusOverdue(order.status, order.statusUpdatedAt) ? 'bg-pink-100 hover:bg-pink-200/70' : 'hover:bg-bg/50'}`}>
                    <td className="px-4 py-3 text-sm font-medium text-text"><span className="inline-flex items-center gap-2">{order.orderNo}{order.hasUnreadMessage && <span className="h-2.5 w-2.5 rounded-full bg-red-500" title="New message"><span className="sr-only">New message</span></span>}</span></td>
                    <td className="px-4 py-3 text-sm text-text">{order.dentist}</td>
                    <td className="px-4 py-3 text-sm text-text">{order.patientName}</td>
                    <td className="px-4 py-3">
                      {canUpdateStatus ? (
                        <select
                          value={order.status}
                          disabled={updatingOrderId === order.id}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium outline-none transition-opacity focus:ring-2 focus:ring-text/10 disabled:cursor-wait disabled:opacity-60 ${
                            ORDER_STATUS_STYLES[order.status] ?? 'border-gray-200 bg-gray-100 text-gray-700'
                          }`}
                          aria-label={`Update status for order ${order.orderNo}`}
                          title="Click to update status"
                        >
                          {ORDER_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${ORDER_STATUS_STYLES[order.status] ?? 'border-gray-200 bg-gray-100 text-gray-700'}`}>
                          {ORDER_STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-muted">{formatDate(order.statusUpdatedAt)}</td>
                    <td className="px-4 py-3 text-sm text-text-muted">{formatDate(order.createdAt)}</td>
                    <td className="w-52 px-4 py-3">
                      {canEditNotes ? (
                        <form onSubmit={(event) => { event.preventDefault(); saveNote(order) }} className="flex items-center gap-1">
                          <input
                            type="text"
                            value={noteDrafts[order.id] ?? order.notes ?? ''}
                            maxLength={ORDER_NOTE_MAX_LENGTH}
                            onChange={(event) => setNoteDrafts((current) => ({ ...current, [order.id]: event.target.value }))}
                            placeholder="Add note"
                            aria-label={`Notes for order ${order.orderNo}`}
                            className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-xs text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10"
                          />
                          <button
                            type="submit"
                            disabled={savingNoteOrderId === order.id || (noteDrafts[order.id] ?? order.notes ?? '').trim() === (order.notes ?? '')}
                            className="grid h-7 w-7 shrink-0 place-items-center rounded text-text hover:bg-bg disabled:pointer-events-none disabled:opacity-20"
                            title="Save note"
                          >
                            <Save className="h-3.5 w-3.5" />
                            <span className="sr-only">Save note for order {order.orderNo}</span>
                          </button>
                        </form>
                      ) : (
                        <p className="max-w-52 truncate text-xs text-text-muted" title={order.notes ?? undefined}>{order.notes || '—'}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => downloadZip(order.id, order.orderNo)}
                          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:border-neutral-400 hover:text-text"
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
                          className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-1 text-xs font-medium text-text hover:bg-neutral-200"
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
