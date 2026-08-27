'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, MessageCircle, Pencil } from 'lucide-react'
import { formatDetailLines } from '@/lib/admin/formatOrderDetails'
import { AddOrderFiles } from '@/components/orderDetails/AddOrderFiles'
import { FinalProductionFiles } from '@/components/orderDetails/FinalProductionFiles'
import { OrderMessagesModal } from '@/components/orderDetails/OrderMessagesModal'
import { UploadedFileList } from '@/components/orderDetails/UploadedFileList'
import { OrderActivityHistory } from '@/components/orderDetails/OrderActivityHistory'
import type { OrderActivityItem } from '@/lib/orderActivity'

interface Order {
  id: number
  orderNo: string
  patientName: string
  treatmentType: string | null
  treatmentData: Record<string, unknown> | null
  toothSelection: Record<string, unknown> | null
  instructions: string | null
  fileUrls: Record<string, string> | null
  productionFileUrls: Record<string, string> | null
  cloudDriveLink: string | null
  cloudDriveLinks: string[] | null
  status: string
}

export function DoctorOrderDetail({ orderId, openMessages = false }: { orderId: string; openMessages?: boolean }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [messagesOpen, setMessagesOpen] = useState(openMessages)
  const [activities, setActivities] = useState<OrderActivityItem[]>([])
  const load = useCallback(async () => {
    const response = await fetch(`/api/portal/orders/${orderId}`)
    const data = await response.json()
    if (!response.ok) setError(data.error ?? 'Unable to load order')
    else {
      setOrder(data.order)
      setActivities(data.activities ?? [])
    }
  }, [orderId])

  useEffect(() => { load() }, [load])
  if (!order) return <p className="text-text-muted">{error ?? 'Loading order...'}</p>

  const files = order.fileUrls ?? {}
  const productionFiles = order.productionFileUrls ?? {}
  const cloudDriveLinks = Array.from(new Set([...(order.cloudDriveLinks ?? []), order.cloudDriveLink].filter(Boolean))) as string[]

  return <><div className="mx-auto max-w-4xl"><div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Link href="/portal/orders" className="text-text-muted hover:text-text"><ArrowLeft className="h-5 w-5" /></Link><div><h1 className="text-xl font-semibold text-text">Order {order.orderNo}</h1><p className="text-sm text-text-muted">Patient: {order.patientName}</p></div></div><div className="flex flex-wrap gap-2"><a href={`/api/portal/orders/${order.id}/download`} className="inline-flex items-center gap-1 rounded-card border border-border px-3 py-2 text-sm hover:border-neutral-400"><Download className="h-4 w-4" />Download ZIP</a><button type="button" onClick={() => setMessagesOpen(true)} className="inline-flex items-center gap-1 rounded-card bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"><MessageCircle className="h-4 w-4" />Message</button>{order.status === 'pending' && <Link href={`/portal/orders/${order.id}/edit`} className="inline-flex items-center gap-1 rounded-card bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-[#e06d15]"><Pencil className="h-4 w-4" />Edit Order</Link>}</div></div><div className="grid gap-5 lg:grid-cols-3"><div className="space-y-4 lg:col-span-2"><Card title="Treatment"><p className="mb-3 font-medium text-secondary">{order.treatmentType ?? '—'}</p><Details lines={formatDetailLines(order.treatmentData)} /></Card><Card title="Tooth Selection & Shade"><Details lines={formatDetailLines(order.toothSelection)} /></Card>{order.instructions && <Card title="Instructions"><p className="whitespace-pre-wrap text-sm">{order.instructions}</p></Card>}<OrderActivityHistory activities={activities} /></div><div className="space-y-4"><Card title="Uploaded Files">{cloudDriveLinks.map((link, index) => <a key={link} href={link} target="_blank" rel="noreferrer" className="mb-3 block truncate text-sm text-text underline">Cloud drive link {index + 1}</a>)}<UploadedFileList files={files} />{Object.keys(files).length === 0 && cloudDriveLinks.length === 0 && <p className="text-sm text-text-muted">No files uploaded.</p>}<AddOrderFiles orderId={order.id} orderNo={order.orderNo} existingSlotIds={Object.keys(files)} onFilesAdded={load} /></Card><FinalProductionFiles orderId={order.id} orderNo={order.orderNo} files={productionFiles} canUpload={false} /></div></div></div>{messagesOpen && <OrderMessagesModal orderId={order.id} orderNo={order.orderNo} onClose={() => setMessagesOpen(false)} />}</>
}

function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-card border border-border bg-surface p-4"><h2 className="mb-3 border-b border-border pb-2 text-sm font-semibold text-secondary">{title}</h2>{children}</section> }
function Details({ lines }: { lines: string[] }) { return lines.length ? <dl className="grid gap-2 text-sm sm:grid-cols-2">{lines.map((line) => { const [label, ...value] = line.split(': '); return <div key={line}><dt className="text-xs text-text-muted">{label}</dt><dd className="font-medium">{value.join(': ')}</dd></div> })}</dl> : <p className="text-sm text-text-muted">No details provided.</p> }
