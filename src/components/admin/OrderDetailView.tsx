'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Link2, Pencil, Save, X } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { ShareLinkModal } from './ShareLinkModal'
import { Toast } from './Toast'
import { SLOT_FOLDER_MAP } from '@/lib/admin/fileSlots'

interface Order {
  id: number
  orderNo: string
  dateSent: string
  dentist: string
  clinic: string
  email: string
  phone: string | null
  address: string
  patientName: string
  patientDob: string
  sex: string | null
  dateRequired: string
  isRepair: boolean
  isRedo: boolean
  isUrgent: boolean
  oldOrderNo: string | null
  treatmentType: string | null
  treatmentData: Record<string, unknown> | null
  toothSelection: Record<string, unknown> | null
  instructions: string | null
  fileUrls: Record<string, string> | null
  status: string
  createdAt: string
}

export function OrderDetailView({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Order>>({})

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/admin/orders/${orderId}`)
    const data = await res.json()
    setOrder(data.order)
    setLoading(false)
  }, [orderId])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  const updateStatus = async (status: string) => {
    await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setToast('Status updated')
    fetchOrder()
  }

  const saveSection = async (section: string) => {
    await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    })
    setEditingSection(null)
    setDraft({})
    setToast(`${section} saved`)
    fetchOrder()
  }

  if (loading || !order) {
    return <p className="text-text-muted">Loading order…</p>
  }

  const fileUrls = order.fileUrls ?? {}

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/submissions" className="text-text-muted hover:text-primary">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-text">Order: {order.orderNo}</h1>
            <StatusBadge status={order.status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={order.status}
            onChange={(e) => updateStatus(e.target.value)}
            className="rounded-card border border-border bg-surface px-3 py-2 text-sm"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="complete">Complete</option>
          </select>
          <button
            type="button"
            onClick={() => { window.location.href = `/api/admin/orders/${orderId}/download` }}
            className="inline-flex items-center gap-1 rounded-card border border-border px-3 py-2 text-sm hover:border-primary"
          >
            <Download className="h-4 w-4" /> ZIP
          </button>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex items-center gap-1 rounded-card border border-border px-3 py-2 text-sm hover:border-accent"
          >
            <Link2 className="h-4 w-4" /> Link
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard
            title="Order Information"
            editing={editingSection === 'info'}
            onEdit={() => {
              setEditingSection('info')
              setDraft({
                dentist: order.dentist,
                clinic: order.clinic,
                email: order.email,
                phone: order.phone ?? '',
                address: order.address,
                patientName: order.patientName,
                patientDob: order.patientDob,
                sex: order.sex ?? '',
                dateRequired: order.dateRequired,
                isRepair: order.isRepair,
                isRedo: order.isRedo,
                isUrgent: order.isUrgent,
                oldOrderNo: order.oldOrderNo ?? '',
              })
            }}
            onSave={() => saveSection('Order Information')}
            onCancel={() => { setEditingSection(null); setDraft({}) }}
          >
            {editingSection === 'info' ? (
              <div className="grid grid-cols-2 gap-3">
                {(['dentist', 'clinic', 'email', 'phone', 'address', 'patientName', 'patientDob', 'sex', 'dateRequired', 'oldOrderNo'] as const).map((f) => (
                  <label key={f} className="block text-xs">
                    <span className="font-medium capitalize">{f.replace(/([A-Z])/g, ' $1')}</span>
                    <input
                      className="mt-1 w-full rounded border border-border px-2 py-1 text-sm"
                      value={String(draft[f] ?? '')}
                      onChange={(e) => setDraft({ ...draft, [f]: e.target.value })}
                    />
                  </label>
                ))}
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={!!draft.isRepair} onChange={(e) => setDraft({ ...draft, isRepair: e.target.checked })} />
                  Repair
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={!!draft.isRedo} onChange={(e) => setDraft({ ...draft, isRedo: e.target.checked })} />
                  Redo
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={!!draft.isUrgent} onChange={(e) => setDraft({ ...draft, isUrgent: e.target.checked })} />
                  Urgent
                </label>
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <Field label="Dentist" value={order.dentist} />
                <Field label="Clinic" value={order.clinic} />
                <Field label="Email" value={order.email} />
                <Field label="Phone" value={order.phone ?? '—'} />
                <Field label="Address" value={order.address} />
                <Field label="Patient" value={order.patientName} />
                <Field label="DOB" value={order.patientDob} />
                <Field label="Sex" value={order.sex ?? '—'} />
                <Field label="Date Required" value={order.dateRequired} />
                <Field label="Flags" value={[order.isRepair && 'Repair', order.isRedo && 'Redo', order.isUrgent && 'Urgent'].filter(Boolean).join(', ') || '—'} />
                {order.oldOrderNo && <Field label="Old Order No" value={order.oldOrderNo} />}
              </dl>
            )}
          </SectionCard>

          {order.treatmentType && (
            <SectionCard title="Treatment" editing={false} hideEdit>
              <p className="mb-2 text-sm font-medium text-secondary">{order.treatmentType}</p>
              <pre className="overflow-auto rounded bg-bg p-3 text-xs text-text">
                {JSON.stringify(order.treatmentData, null, 2)}
              </pre>
            </SectionCard>
          )}

          {order.toothSelection && (
            <SectionCard title="Tooth Selection & Shade" editing={false} hideEdit>
              <pre className="overflow-auto rounded bg-bg p-3 text-xs text-text">
                {JSON.stringify(order.toothSelection, null, 2)}
              </pre>
            </SectionCard>
          )}

          {order.instructions && (
            <SectionCard
              title="Instructions"
              editing={editingSection === 'instructions'}
              onEdit={() => {
                setEditingSection('instructions')
                setDraft({ instructions: order.instructions ?? '' })
              }}
              onSave={() => saveSection('Instructions')}
              onCancel={() => { setEditingSection(null); setDraft({}) }}
            >
              {editingSection === 'instructions' ? (
                <textarea
                  className="w-full rounded border border-border p-2 text-sm"
                  rows={4}
                  value={draft.instructions ?? ''}
                  onChange={(e) => setDraft({ instructions: e.target.value })}
                />
              ) : (
                <p className="text-sm text-text">{order.instructions}</p>
              )}
            </SectionCard>
          )}
        </div>

        <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-secondary">Uploaded Files</h2>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(fileUrls).map(([slotId, url]) => {
              const label = SLOT_FOLDER_MAP[slotId]?.filename ?? slotId
              const isImage = /\.(jpg|jpeg|png|gif|webp)/i.test(url)
              return (
                <div key={slotId} className="rounded border border-border p-2">
                  {isImage ? (
                    <img src={url} alt={label} className="mb-2 h-20 w-full rounded object-cover" />
                  ) : (
                    <div className="mb-2 flex h-20 items-center justify-center rounded bg-bg text-xs text-text-muted">
                      STL / File
                    </div>
                  )}
                  <p className="truncate text-xs font-medium">{label}</p>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary underline">
                    Download
                  </a>
                </div>
              )
            })}
            {Object.keys(fileUrls).length === 0 && (
              <p className="text-sm text-text-muted">No files uploaded</p>
            )}
          </div>
        </div>
      </div>

      {shareOpen && <ShareLinkModal orderId={order.id} onClose={() => setShareOpen(false)} />}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="font-medium text-text">{value}</dd>
    </div>
  )
}

function SectionCard({
  title,
  children,
  editing,
  hideEdit,
  onEdit,
  onSave,
  onCancel,
}: {
  title: string
  children: React.ReactNode
  editing: boolean
  hideEdit?: boolean
  onEdit?: () => void
  onSave?: () => void
  onCancel?: () => void
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
        <h2 className="text-sm font-semibold text-secondary">{title}</h2>
        {!hideEdit && !editing ? (
          <button type="button" onClick={onEdit} className="text-xs text-primary hover:underline">
            <Pencil className="inline h-3.5 w-3.5" /> Edit
          </button>
        ) : !hideEdit && editing ? (
          <div className="flex gap-2">
            <button type="button" onClick={onSave} className="inline-flex items-center gap-1 text-xs text-green-600">
              <Save className="h-3.5 w-3.5" /> Save
            </button>
            <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 text-xs text-text-muted">
              <X className="h-3.5 w-3.5" /> Cancel
            </button>
          </div>
        ) : null}
      </div>
      {children}
    </div>
  )
}
