'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Pencil } from 'lucide-react'
import { formatDetailLines } from '@/lib/admin/formatOrderDetails'

interface Order {
  id: number
  orderNo: string
  patientName: string
  treatmentType: string | null
  treatmentData: Record<string, unknown> | null
  toothSelection: Record<string, unknown> | null
  instructions: string | null
  fileUrls: Record<string, string> | null
  cloudDriveLink: string | null
  cloudDriveLinks: string[] | null
  status: string
}

export function DoctorOrderDetail({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    const response = await fetch(`/api/portal/orders/${orderId}`)
    const data = await response.json()
    if (!response.ok) setError(data.error ?? 'Unable to load order')
    else setOrder(data.order)
  }, [orderId])

  useEffect(() => { load() }, [load])
  if (!order) return <p className="text-text-muted">{error ?? 'Loading order...'}</p>

  const files = order.fileUrls ?? {}
  const cloudDriveLinks = Array.from(new Set([...(order.cloudDriveLinks ?? []), order.cloudDriveLink].filter(Boolean))) as string[]

  return <div className="mx-auto max-w-4xl"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link href="/portal/orders" className="text-text-muted hover:text-primary"><ArrowLeft className="h-5 w-5" /></Link><div><h1 className="text-xl font-semibold text-text">Order {order.orderNo}</h1><p className="text-sm text-text-muted">Patient: {order.patientName}</p></div></div><div className="flex gap-2"><a href={`/api/portal/orders/${order.id}/download`} className="inline-flex items-center gap-1 rounded-card border border-border px-3 py-2 text-sm hover:border-primary"><Download className="h-4 w-4" />Download ZIP</a>{order.status === 'pending' && <Link href={`/portal/orders/${order.id}/edit`} className="inline-flex items-center gap-1 rounded-card bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-[#e06d15]"><Pencil className="h-4 w-4" />Edit Order</Link>}</div></div><div className="grid gap-5 lg:grid-cols-3"><div className="space-y-4 lg:col-span-2"><Card title="Treatment"><p className="mb-3 font-medium text-secondary">{order.treatmentType ?? '—'}</p><Details lines={formatDetailLines(order.treatmentData)} /></Card><Card title="Tooth Selection & Shade"><Details lines={formatDetailLines(order.toothSelection)} /></Card>{order.instructions && <Card title="Instructions"><p className="whitespace-pre-wrap text-sm">{order.instructions}</p></Card>}</div><Card title="Files">{cloudDriveLinks.map((link, index) => <a key={link} href={link} target="_blank" rel="noreferrer" className="mb-3 block break-all text-sm text-primary underline">Cloud drive link {index + 1}</a>)}<div className="space-y-2">{Object.entries(files).map(([slot, url]) => <a key={slot} href={url} target="_blank" rel="noreferrer" className="block rounded border border-border px-3 py-2 text-sm text-primary hover:bg-bg">{slot.replace(/-/g, ' ')}</a>)}{Object.keys(files).length === 0 && cloudDriveLinks.length === 0 && <p className="text-sm text-text-muted">No files uploaded.</p>}</div></Card></div></div>
}

function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-card border border-border bg-surface p-4 shadow-sm"><h2 className="mb-3 border-b border-border pb-2 text-sm font-semibold text-secondary">{title}</h2>{children}</section> }
function Details({ lines }: { lines: string[] }) { return lines.length ? <dl className="grid gap-2 text-sm sm:grid-cols-2">{lines.map((line) => { const [label, ...value] = line.split(': '); return <div key={line}><dt className="text-xs text-text-muted">{label}</dt><dd className="font-medium">{value.join(': ')}</dd></div> })}</dl> : <p className="text-sm text-text-muted">No details provided.</p> }
