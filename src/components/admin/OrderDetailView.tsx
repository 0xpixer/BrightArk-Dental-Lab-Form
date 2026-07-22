'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Link2, Pencil, Save, X } from 'lucide-react'
import { StatusBadge } from './StatusBadge'
import { ShareLinkModal } from './ShareLinkModal'
import { Toast } from './Toast'
import { SLOT_FOLDER_MAP } from '@/lib/admin/fileSlots'
import { formatDetailLines } from '@/lib/admin/formatOrderDetails'

interface Order {
  id: number
  orderNo: string
  dateSent: string
  dentist: string
  clinic: string
  email: string
  altEmail: string | null
  phone: string | null
  address: string | null
  billingAddress: string | null
  patientName: string
  patientDob: string | null
  patientAge: string | null
  sex: string | null
  dateRequired: string | null
  isRepair: boolean
  isRedo: boolean
  isUrgent: boolean
  oldOrderNo: string | null
  treatmentType: string | null
  treatmentData: Record<string, unknown> | null
  toothSelection: Record<string, unknown> | null
  instructions: string | null
  fileUrls: Record<string, string> | null
  cloudDriveLink: string | null
  status: string
  createdAt: string
}

export function OrderDetailView({ orderId, canModify }: { orderId: string; canModify: boolean }) {
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
    if (!canModify) return
    await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setToast('Status updated')
    fetchOrder()
  }

  const saveSection = async (section: string) => {
    if (!canModify) return
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
  const treatmentLines = formatDetailLines(order.treatmentData)
  const toothSelectionLines = formatDetailLines(order.toothSelection)

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
          {canModify && (
            <select
              value={order.status}
              onChange={(e) => updateStatus(e.target.value)}
              className="rounded-card border border-border bg-surface px-3 py-2 text-sm"
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="complete">Complete</option>
            </select>
          )}
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
            hideEdit={!canModify}
            onEdit={() => {
              setEditingSection('info')
              setDraft({
                dentist: order.dentist,
                clinic: order.clinic,
                email: order.email,
                address: order.address ?? '',
                billingAddress: order.billingAddress ?? '',
                patientName: order.patientName,
                patientAge: order.patientAge ?? '',
                patientDob: order.patientDob ?? '',
                sex: order.sex ?? '',
                cloudDriveLink: order.cloudDriveLink ?? '',
              })
            }}
            onSave={() => saveSection('Order Information')}
            onCancel={() => { setEditingSection(null); setDraft({}) }}
          >
            {editingSection === 'info' ? (
              <div className="grid grid-cols-2 gap-3">
                {(['dentist', 'clinic', 'email', 'address', 'billingAddress', 'patientName', 'patientAge', 'patientDob', 'sex', 'cloudDriveLink'] as const).map((f) => (
                  <label key={f} className="block text-xs">
                    <span className="font-medium capitalize">{f.replace(/([A-Z])/g, ' $1')}</span>
                    <input
                      className="mt-1 w-full rounded border border-border px-2 py-1 text-sm"
                      value={String(draft[f] ?? '')}
                      onChange={(e) => setDraft({ ...draft, [f]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <Field label="Dentist" value={order.dentist} />
                <Field label="Clinic" value={order.clinic} />
                <Field label="Email" value={order.email} />
                <Field label="Delivery Address" value={order.address ?? '—'} />
                <Field label="Bill Address" value={order.billingAddress ?? order.address ?? '—'} />
                <Field label="Patient" value={order.patientName} />
                <Field label="Age" value={order.patientAge ?? '—'} />
                {order.patientDob && <Field label="DOB" value={order.patientDob} />}
                <Field label="Sex" value={order.sex ?? '—'} />
                <Field label="Cloud Drive Link" value={order.cloudDriveLink ?? '—'} />
              </dl>
            )}
          </SectionCard>

          {order.treatmentType && (
            <SectionCard title="Treatment" editing={false} hideEdit>
              <p className="mb-2 text-sm font-medium text-secondary">{order.treatmentType}</p>
              <DetailList lines={treatmentLines} />
            </SectionCard>
          )}

          {order.toothSelection && (
            <SectionCard title="Tooth Selection & Shade" editing={false} hideEdit>
              <DetailList lines={toothSelectionLines} />
            </SectionCard>
          )}

          {order.instructions && (
            <SectionCard
              title="Instructions"
              editing={editingSection === 'instructions'}
              hideEdit={!canModify}
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
          {order.cloudDriveLink && (
            <div className="mb-4 rounded border border-primary/20 bg-primary/5 p-3">
              <p className="text-xs font-semibold text-secondary">Cloud Drive Link</p>
              <a
                href={order.cloudDriveLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block break-all text-xs text-primary underline"
              >
                {order.cloudDriveLink}
              </a>
            </div>
          )}
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
            {Object.keys(fileUrls).length === 0 && !order.cloudDriveLink && (
              <p className="text-sm text-text-muted">No files uploaded or linked</p>
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

function DetailList({ lines }: { lines: string[] }) {
  if (lines.length === 0) return <p className="text-sm text-text-muted">No details provided</p>

  return (
    <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
      {lines.map((line) => {
        const [label, ...valueParts] = line.split(': ')
        return (
          <div key={line}>
            <dt className="text-xs text-text-muted">{label}</dt>
            <dd className="font-medium text-text">{valueParts.join(': ')}</dd>
          </div>
        )
      })}
    </dl>
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
