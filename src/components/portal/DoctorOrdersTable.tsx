'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

interface Order { id: number; orderNo: string; patientName: string; treatmentType: string | null; status: string; createdAt: string }

export function DoctorOrdersTable() {
  const [orders, setOrders] = useState<Order[]>([])
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    const response = await fetch('/api/portal/orders')
    const data = await response.json()
    if (!response.ok) setError(data.error ?? 'Unable to load orders')
    else setOrders(data.orders ?? [])
  }, [])
  useEffect(() => { load() }, [load])
  return <><div className="mb-5 flex items-center justify-between"><div><h1 className="text-xl font-semibold text-text">Dashboard</h1><p className="mt-1 text-sm text-text-muted">Orders submitted for your clinic.</p></div><Link href="/" className="rounded-card bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-[#e06d15]">New Order</Link></div><div className="overflow-hidden rounded-card border border-border bg-surface shadow-sm"><table className="w-full"><thead className="border-b border-border bg-bg"><tr>{['Order', 'Patient', 'Treatment', 'Status', 'Submitted', ''].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase text-text-muted">{heading}</th>)}</tr></thead><tbody>{error ? <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-red-600">{error}</td></tr> : orders.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-text-muted">No orders yet.</td></tr> : orders.map((order) => <tr key={order.id} className="border-b border-border last:border-0"><td className="px-4 py-3 text-sm font-medium">{order.orderNo}</td><td className="px-4 py-3 text-sm">{order.patientName}</td><td className="px-4 py-3 text-sm text-text-muted">{order.treatmentType ?? '—'}</td><td className="px-4 py-3"><Status status={order.status} /></td><td className="px-4 py-3 text-sm text-text-muted">{new Date(order.createdAt).toLocaleDateString()}</td><td className="px-4 py-3 text-right"><Link href={`/portal/orders/${order.id}`} className="text-sm font-medium text-primary hover:underline">View</Link></td></tr>)}</tbody></table></div></>
}

function Status({ status }: { status: string }) { return <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium capitalize text-primary">{status.replace('_', ' ')}</span> }
