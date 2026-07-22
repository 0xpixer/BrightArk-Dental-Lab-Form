'use client'

import { useCallback, useEffect, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { FileArchive, Image, Info, Link2, Plus, X } from 'lucide-react'
import type { FieldError, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import type { FileSlotId, OrderFormValues } from '@/types/orderForm'
import { SectionCard } from './ui/SectionCard'
import { inputClassName } from './ui/FormField'
import { FILE_SLOT_GROUPS, type FileSlotConfig } from './fileUpload/slotConfig'
import { UploadSlotCard, type SlotFile } from './fileUpload/UploadSlotCard'
import type { Dispatch, SetStateAction } from 'react'

export type FilesState = Partial<Record<FileSlotId, SlotFile>>

interface FileUploadSectionProps {
  orderNo: string
  files: FilesState
  onFilesChange: Dispatch<SetStateAction<FilesState>>
  register: UseFormRegister<OrderFormValues>
  watch: UseFormWatch<OrderFormValues>
  setValue: UseFormSetValue<OrderFormValues>
  error?: FieldError['message']
  onTitleClick?: () => void
}

const CASE_PACKAGE_SLOT: FileSlotConfig = {
  id: 'case-package',
  label: 'Compressed Case Package',
  accept: '.zip,.rar,.7z,.tar,.gz,application/zip,application/x-zip-compressed,application/x-rar-compressed,application/x-7z-compressed,application/gzip',
  icon: 'scan',
  formatBadge: 'ZIP / RAR / 7Z',
}

function Tooltip({ text }: { text: string }) {
  return <button type="button" className="text-secondary" title={text}><Info className="h-3.5 w-3.5" aria-hidden /><span className="sr-only">{text}</span></button>
}

function slotGridClass(heading: string, slotCount: number): string {
  if (heading === 'Oral Scans') return 'grid-cols-2'
  if (slotCount >= 3) return 'grid-cols-2 sm:grid-cols-3'
  return 'grid-cols-2'
}

export function FileUploadSection({ orderNo, files, onFilesChange, register, watch, setValue, error, onTitleClick }: FileUploadSectionProps) {
  const [activeTab, setActiveTab] = useState<'photos' | 'package' | 'links'>('photos')
  const cloudLinks = watch('cloudDriveLinks') ?? ['']

  const uploadFile = useCallback(async (slotId: FileSlotId, file: File) => {
    const existing = files[slotId]
    if (existing?.previewUrl) URL.revokeObjectURL(existing.previewUrl)

    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const pathname = `orders/${orderNo}/${slotId}/${safeName}`

    onFilesChange((previous) => ({ ...previous, [slotId]: { file, previewUrl, progress: 0, status: 'uploading' } }))

    try {
      const blob = await upload(pathname, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        onUploadProgress: ({ percentage }) => onFilesChange((previous) => {
          const current = previous[slotId]
          return current ? { ...previous, [slotId]: { ...current, progress: percentage } } : previous
        }),
      })

      onFilesChange((previous) => {
        const current = previous[slotId]
        return current ? { ...previous, [slotId]: { ...current, progress: 100, blobUrl: blob.url, status: 'success', error: undefined } } : previous
      })
    } catch (uploadError) {
      console.error('Upload error for slot', slotId, uploadError)
      onFilesChange((previous) => {
        const current = previous[slotId]
        return current ? { ...previous, [slotId]: { ...current, progress: 0, status: 'error', error: uploadError instanceof Error ? uploadError.message : 'Upload failed' } } : previous
      })
    }
  }, [files, onFilesChange, orderNo])

  const removeFile = useCallback((slotId: FileSlotId) => {
    const existing = files[slotId]
    if (existing?.previewUrl) URL.revokeObjectURL(existing.previewUrl)
    const next = { ...files }
    delete next[slotId]
    onFilesChange(next)
  }, [files, onFilesChange])

  useEffect(() => () => {
    Object.values(files).forEach((file) => {
      if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateCloudLink = (index: number, value: string) => {
    const next = [...cloudLinks]
    next[index] = value
    setValue('cloudDriveLinks', next, { shouldDirty: true, shouldValidate: true })
  }

  return (
    <SectionCard title="Upload Files" id="file-upload" className="!border-primary/20" onTitleClick={onTitleClick}>
      <div className="space-y-5">
        <div className="grid grid-cols-3 border-b border-border" role="tablist" aria-label="File upload options">
          {[
            { id: 'photos', label: 'Photos', icon: Image },
            { id: 'package', label: 'Case Package', icon: FileArchive },
            { id: 'links', label: 'Cloud Links', icon: Link2 },
          ].map((tab) => {
            const Icon = tab.icon
            const selected = activeTab === tab.id
            return <button key={tab.id} type="button" role="tab" aria-selected={selected} onClick={() => setActiveTab(tab.id as typeof activeTab)} className={`flex items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 text-xs font-semibold ${selected ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'}`}><Icon className="h-3.5 w-3.5" />{tab.label}</button>
          })}
        </div>

        {activeTab === 'photos' && <div className="space-y-6">
          {FILE_SLOT_GROUPS.map((group) => <div key={group.heading}>
            <div className="mb-2 flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-primary">{group.heading}</h3>{group.tooltip && <Tooltip text={group.tooltip} />}</div>
            {group.note && <p className="mb-2 text-xs text-text-muted">{group.note}</p>}
            <div className={`grid gap-3 ${slotGridClass(group.heading, group.slots.length)}`}>
              {group.slots.map((slot) => <UploadSlotCard key={slot.id} slot={slot} slotFile={files[slot.id]} onSelect={(file) => uploadFile(slot.id, file)} onRemove={() => removeFile(slot.id)} onRetry={() => { const current = files[slot.id]; if (current?.file) uploadFile(slot.id, current.file) }} />)}
            </div>
          </div>)}
        </div>}

        {activeTab === 'package' && <div className="space-y-3">
          <p className="text-sm text-text-muted">Upload one compressed folder containing all STL, scan, and supporting case files.</p>
          <div className="max-w-sm"><UploadSlotCard slot={CASE_PACKAGE_SLOT} slotFile={files['case-package']} onSelect={(file) => uploadFile('case-package', file)} onRemove={() => removeFile('case-package')} onRetry={() => { const current = files['case-package']; if (current?.file) uploadFile('case-package', current.file) }} /></div>
        </div>}

        {activeTab === 'links' && <div className="space-y-3">
          <p className="text-sm text-text-muted">Add shared download links from Google Drive, Dropbox, OneDrive, WeTransfer, or another cloud service.</p>
          {cloudLinks.map((link, index) => <div key={index} className="flex gap-2"><input type="url" placeholder="https://..." value={link} {...register(`cloudDriveLinks.${index}`)} onChange={(event) => updateCloudLink(index, event.target.value)} className={inputClassName(Boolean(error))} />{cloudLinks.length > 1 && <button type="button" onClick={() => setValue('cloudDriveLinks', cloudLinks.filter((_, linkIndex) => linkIndex !== index), { shouldDirty: true, shouldValidate: true })} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-card border border-border text-text-muted hover:border-red-300 hover:text-red-600" title="Remove link"><X className="h-4 w-4" /></button>}</div>)}
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <button type="button" onClick={() => setValue('cloudDriveLinks', [...cloudLinks, ''], { shouldDirty: true })} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-secondary"><Plus className="h-4 w-4" />Add another link</button>
        </div>}
      </div>
    </SectionCard>
  )
}
