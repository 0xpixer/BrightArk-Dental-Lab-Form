'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { isOrderStatusOverdue, ORDER_STATUS_OPTIONS } from '@/lib/orderStatus'

interface Order {
  id: number
  orderNo: string
  patientName: string
  treatmentType: string | null
  status: string
  statusUpdatedAt: string
  createdAt: string
  hasUnreadMessage: boolean
}

interface Draft {
  id: number
  formData: {
    patient?: string
    treatmentCategory?: string
  }
  updatedAt: string
}

const treatmentLabels: Record<string, string> = {
  fixed: 'Fixed Restoration',
  implant: 'Implant',
  orthodontics: 'Orthodontics',
  additional: 'Lab Services',
  removable: 'Removable Restoration',
}

export function DoctorOrdersTable({ initialStatus = 'all' }: { initialStatus?: string }) {
  const [orders, setOrders] = useState<Order[]>([])
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState(initialStatus)

  const filteredOrders = useMemo(() => orders.filter((order) => {
    if (status === 'all') return true
    if (status === 'overdue') return isOrderStatusOverdue(order.status, order.statusUpdatedAt)
    return order.status === status
  }), [orders, status])

  const load = useCallback(async () => {
    const [ordersResponse, draftsResponse] = await Promise.all([
      fetch('/api/portal/orders'),
      fetch('/api/portal/drafts'),
    ])
    const ordersData = await ordersResponse.json()
    const draftsData = await draftsResponse.json()

    if (!ordersResponse.ok) {
      setError(ordersData.error ?? 'Unable to load orders')
      return
    }
    if (!draftsResponse.ok) {
      setError(draftsData.error ?? 'Unable to load drafts')
      return
    }

    setOrders(ordersData.orders ?? [])
    setDrafts(draftsData.drafts ?? [])
  }, [])

  const deleteDraft = useCallback(async (id: number) => {
    if (!confirm('Delete this draft? This cannot be undone.')) return
    const response = await fetch(`/api/portal/drafts/${id}`, { method: 'DELETE' })
    if (!response.ok) {
      setError('Unable to delete draft')
      return
    }
    setDrafts((current) => current.filter((draft) => draft.id !== id))
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">Orders</h1>
          <p className="mt-1 text-sm text-text-muted">Orders and saved work for your clinic.</p>
        </div>
        <Link href="/" className="rounded-card bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#e06d15]">
          New Order
        </Link>
      </div>

      {error && <p className="mb-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <section className="mb-6 overflow-hidden rounded-card border border-border bg-surface">
        <div className="border-b border-border bg-bg px-4 py-3">
          <h2 className="text-sm font-semibold text-text">Saved Drafts</h2>
        </div>
        {drafts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-text-muted">No saved drafts yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {drafts.map((draft) => (
              <div key={draft.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text">{draft.formData.patient || 'Untitled case'}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {treatmentLabels[draft.formData.treatmentCategory ?? ''] ?? 'Treatment not selected'}
                    {' - '}Saved {new Date(draft.updatedAt).toLocaleString()}
                  </p>
                </div>
                <Link href={`/portal/drafts/${draft.id}`} className="text-sm font-medium text-text hover:underline">Continue</Link>
                <button type="button" onClick={() => deleteDraft(draft.id)} className="text-sm text-text-muted hover:text-red-600">Delete</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <table className="w-full">
          <thead className="border-b border-border bg-bg">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted">Order</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted">Patient</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted">Treatment</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-text-muted">
                <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filter orders by status" className="min-w-32 rounded border border-border bg-surface px-2 py-1 text-xs font-medium normal-case text-text outline-none focus:border-text focus:ring-2 focus:ring-text/10">
                  <option value="all">All statuses</option>
                  {ORDER_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  <option value="overdue">Overdue</option>
                </select>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted">Submitted</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-text-muted">No matching orders.</td></tr>
            ) : filteredOrders.map((order) => (
              <tr key={order.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-sm font-medium"><span className="inline-flex items-center gap-2">{order.orderNo}{order.hasUnreadMessage && <span className="h-2.5 w-2.5 rounded-full bg-red-500" title="New message"><span className="sr-only">New message</span></span>}</span></td>
                <td className="px-4 py-3 text-sm">{order.patientName}</td>
                <td className="px-4 py-3 text-sm text-text-muted">{order.treatmentType ?? '—'}</td>
                <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                <td className="px-4 py-3 text-sm text-text-muted">{new Date(order.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right"><Link href={`/portal/orders/${order.id}`} className="text-sm font-medium text-text hover:underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
