'use client'

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { upload } from '@vercel/blob/client'
import { Eye, FileIcon, Plus, RotateCcw, X } from 'lucide-react'
import { UploadSlotCard, type SlotFile } from '@/components/fileUpload/UploadSlotCard'
import type { FileSlotConfig } from '@/components/fileUpload/slotConfig'
import { FilePreviewModal, type PreviewFile } from '@/components/orderDetails/FilePreviewModal'
import { getFilePreviewKind } from '@/lib/filePreview'
import type { IDesignFileSlot } from '@/lib/idesign/cases'

export interface IDesignUploadFile extends SlotFile {
  id: string
}

export type IDesignUploadState = Partial<Record<IDesignFileSlot, IDesignUploadFile[]>>

const GROUPS: Array<{ heading: string; note?: string; slots: Array<FileSlotConfig & { id: IDesignFileSlot }> }> = [
  {
    heading: 'Oral scans',
    note: 'STL files',
    slots: [
      { id: 'upper-model', label: 'Upper Model', required: true, accept: '.stl,model/stl,application/octet-stream', icon: 'scan', illustrationSrc: '/idesign-upper-model.png', formatBadge: 'STL' },
      { id: 'lower-model', label: 'Lower Model', required: true, accept: '.stl,model/stl,application/octet-stream', icon: 'scan', illustrationSrc: '/idesign-lower-model.png', formatBadge: 'STL' },
    ],
  },
  {
    heading: 'X-ray',
    note: 'Optional',
    slots: [
      { id: 'panoramic-xray', label: 'Panoramic X-ray', accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', icon: 'photo', illustrationSrc: '/idesign-panoramic-xray.png' },
      { id: 'lateral-ceph', label: 'Lateral Ceph', accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', icon: 'photo', illustrationSrc: '/idesign-lateral-ceph.png' },
    ],
  },
  {
    heading: 'Facial photos',
    slots: [
      { id: 'frontal-view', label: 'Frontal View', required: true, accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', icon: 'photo', illustrationSrc: '/idesign-frontal-view.png' },
      { id: 'frontal-smile', label: 'Frontal Smile', required: true, accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', icon: 'photo', illustrationSrc: '/idesign-frontal-smile.png' },
      { id: 'profile-view', label: 'Profile View', required: true, accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', icon: 'photo', illustrationSrc: '/idesign-profile-view.png' },
    ],
  },
  {
    heading: 'Intraoral photos',
    note: 'Optional',
    slots: [
      { id: 'upper-arch', label: 'Upper Arch', accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', icon: 'intraoral', illustrationSrc: '/idesign-upper-arch.png' },
      { id: '45-central', label: '45° Central', accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', icon: 'intraoral', illustrationSrc: '/idesign-45-central.png' },
      { id: 'right-occlusal', label: 'Right (Occlusal)', accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', icon: 'intraoral', illustrationSrc: '/idesign-right-occlusal.png' },
      { id: 'central-occlusal', label: 'Central (Occlusal)', accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', icon: 'intraoral', illustrationSrc: '/idesign-central-occlusal.png' },
      { id: 'left-occlusal', label: 'Left (Occlusal)', accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', icon: 'intraoral', illustrationSrc: '/idesign-left-occlusal.png' },
      { id: 'lower-arch', label: 'Lower Arch', accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', icon: 'intraoral', illustrationSrc: '/idesign-lower-arch.png' },
    ],
  },
]

export function IDesignCaseUploads({ uploadId, value, onChange, errors = {} }: { uploadId: string; value: IDesignUploadState; onChange: Dispatch<SetStateAction<IDesignUploadState>>; errors?: Partial<Record<string, string>> }) {
  const [preview, setPreview] = useState<PreviewFile | null>(null)
  const cbctInput = useRef<HTMLInputElement>(null)
  const filesRef = useRef(value)
  filesRef.current = value

  const updateSlot = useCallback((slot: IDesignFileSlot, updater: (files: IDesignUploadFile[]) => IDesignUploadFile[]) => {
    onChange((current) => ({ ...current, [slot]: updater(current[slot] ?? []) }))
  }, [onChange])

  const uploadFile = useCallback(async (slot: IDesignFileSlot, file: File, existingId?: string) => {
    const id = existingId ?? crypto.randomUUID()
    const previousPreview = existingId ? filesRef.current[slot]?.find((item) => item.id === existingId)?.previewUrl : undefined
    if (previousPreview) URL.revokeObjectURL(previousPreview)
    const previewUrl = file.type.startsWith('image/') || file.name.toLowerCase().endsWith('.stl') ? URL.createObjectURL(file) : undefined
    const entry: IDesignUploadFile = { id, file, previewUrl, progress: 0, status: 'uploading' }
    updateSlot(slot, (files) => existingId ? files.map((item) => item.id === existingId ? entry : item) : [...files, entry])
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    try {
      const blob = await upload(`idesign/${uploadId}/${slot}/${id}-${safeName}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        onUploadProgress: ({ percentage }) => updateSlot(slot, (files) => files.map((item) => item.id === id ? { ...item, progress: percentage } : item)),
      })
      updateSlot(slot, (files) => files.map((item) => item.id === id ? { ...item, blobUrl: blob.url, progress: 100, status: 'success', error: undefined } : item))
    } catch (error) {
      updateSlot(slot, (files) => files.map((item) => item.id === id ? { ...item, progress: 0, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' } : item))
    }
  }, [updateSlot, uploadId])

  const remove = (slot: IDesignFileSlot, id: string) => {
    const item = value[slot]?.find((file) => file.id === id)
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
    updateSlot(slot, (files) => files.filter((file) => file.id !== id))
  }

  useEffect(() => () => {
    Object.values(filesRef.current).flat().forEach((file) => file?.previewUrl && URL.revokeObjectURL(file.previewUrl))
  }, [])

  const openPreview = (item: IDesignUploadFile) => {
    const url = item.previewUrl || item.blobUrl
    if (!url) return
    const kind = getFilePreviewKind(item.blobUrl || item.file.name)
    if (kind) setPreview({ url, filename: item.file.name, kind })
  }

  return <div className="space-y-6">
    {GROUPS.map((group) => <section key={group.heading}>
      <div className="mb-3 flex items-baseline gap-2"><h3 className="text-sm font-semibold text-text">{group.heading}{group.slots.some((slot) => slot.required) && <span className="text-red-500"> *</span>}</h3>{group.note && <span className="text-xs text-text-muted">{group.note}</span>}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.slots.map((slot) => {
          const item = value[slot.id]?.[0]
          return <div key={slot.id} className="space-y-1.5">
            <UploadSlotCard slot={slot} slotFile={item} hasError={Boolean(errors[slot.id])} onSelect={(file) => uploadFile(slot.id, file, item?.id)} onRemove={() => item && remove(slot.id, item.id)} onRetry={() => item && uploadFile(slot.id, item.file, item.id)} />
            {item?.status === 'success' && getFilePreviewKind(item.blobUrl || item.file.name) && <button type="button" onClick={() => openPreview(item)} className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text"><Eye className="h-3.5 w-3.5" />Preview</button>}
            {errors[slot.id] && <p role="alert" className="text-xs text-red-600">{errors[slot.id]}</p>}
          </div>
        })}
      </div>
    </section>)}

    <section>
      <div className="mb-3 flex items-baseline gap-2"><h3 className="text-sm font-semibold text-text">CBCT</h3><span className="text-xs text-text-muted">Optional, multiple files allowed</span></div>
      <input ref={cbctInput} type="file" multiple className="sr-only" accept=".dcm,.zip,.rar,.7z,application/dicom,application/zip,application/octet-stream" onChange={(event) => { Array.from(event.target.files ?? []).forEach((file) => uploadFile('cbct', file)); event.target.value = '' }} />
      <button type="button" onClick={() => cbctInput.current?.click()} className="inline-flex h-10 items-center gap-2 rounded-card border border-border bg-surface px-3 text-sm font-medium text-text hover:bg-bg"><Plus className="h-4 w-4" />Add CBCT files</button>
      {(value.cbct?.length ?? 0) > 0 && <div className="mt-3 divide-y divide-border overflow-hidden rounded-card border border-border">{value.cbct!.map((item) => <div key={item.id} className="flex items-center gap-3 px-3 py-2.5"><FileIcon className="h-4 w-4 shrink-0 text-text-muted" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-text">{item.file.name}</p>{item.status === 'uploading' && <div className="mt-1 h-1 overflow-hidden rounded-full bg-border"><div className="h-full bg-primary" style={{ width: `${item.progress}%` }} /></div>}{item.status === 'error' && <p className="mt-1 text-xs text-red-600">{item.error}</p>}</div>{item.status === 'error' && <button type="button" title="Retry" onClick={() => uploadFile('cbct', item.file, item.id)} className="p-2 text-text-muted hover:text-text"><RotateCcw className="h-4 w-4" /></button>}<button type="button" title="Remove" onClick={() => remove('cbct', item.id)} className="p-2 text-text-muted hover:text-red-600"><X className="h-4 w-4" /></button></div>)}</div>}
    </section>
    {preview && <FilePreviewModal file={preview} onClose={() => setPreview(null)} />}
  </div>
}
