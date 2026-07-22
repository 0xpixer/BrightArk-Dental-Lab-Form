'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface Order {
  id: number
  orderNo: string
  patientName: string
  treatmentType: string | null
  status: string
  createdAt: string
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

export function DoctorOrdersTable() {
  const [orders, setOrders] = useState<Order[]>([])
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [error, setError] = useState<string | null>(null)

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
          <h1 className="text-xl font-semibold text-text">Dashboard</h1>
          <p className="mt-1 text-sm text-text-muted">Orders and saved work for your clinic.</p>
        </div>
        <Link href="/" className="rounded-card bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#e06d15]">
          New Order
        </Link>
      </div>

      {error && <p className="mb-4 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <section className="mb-6 overflow-hidden rounded-card border border-border bg-surface shadow-sm">
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
                <Link href={`/portal/drafts/${draft.id}`} className="text-sm font-medium text-primary hover:underline">Continue</Link>
                <button type="button" onClick={() => deleteDraft(draft.id)} className="text-sm text-text-muted hover:text-red-600">Delete</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm">
        <table className="w-full">
          <thead className="border-b border-border bg-bg">
            <tr>
              {['Order', 'Patient', 'Treatment', 'Status', 'Submitted', ''].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-text-muted">No orders yet.</td></tr>
            ) : orders.map((order) => (
              <tr key={order.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-sm font-medium">{order.orderNo}</td>
                <td className="px-4 py-3 text-sm">{order.patientName}</td>
                <td className="px-4 py-3 text-sm text-text-muted">{order.treatmentType ?? '—'}</td>
                <td className="px-4 py-3"><Status status={order.status} /></td>
                <td className="px-4 py-3 text-sm text-text-muted">{new Date(order.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right"><Link href={`/portal/orders/${order.id}`} className="text-sm font-medium text-primary hover:underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

function Status({ status }: { status: string }) {
  return <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium capitalize text-primary">{status.replace('_', ' ')}</span>
}
