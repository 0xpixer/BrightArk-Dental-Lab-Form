'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { Check, FileArchive, FileIcon, Image, Link2, Plus, RotateCcw, UploadCloud, X } from 'lucide-react'
import type { FieldError, UseFormRegister, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import { type FileSlotId, type OrderFormValues } from '@/types/orderForm'
import { SectionCard } from './ui/SectionCard'
import { inputClassName } from './ui/FormField'
import type { FileSlotConfig } from './fileUpload/slotConfig'
import { UploadSlotCard, type SlotFile } from './fileUpload/UploadSlotCard'
import type { Dispatch, SetStateAction } from 'react'

export type FilesState = Partial<Record<FileSlotId, SlotFile>>

interface FileUploadSectionProps {
  orderNo: string
  files: FilesState
  reservedSlotIds?: string[]
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

const BULK_FILE_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.stl,.obj,.ply,image/jpeg,image/png,image/webp,application/pdf,model/stl,model/obj,model/ply,application/octet-stream'
const SUPPORTED_BULK_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf', 'stl', 'obj', 'ply'])

function isSupportedBulkFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  return SUPPORTED_BULK_EXTENSIONS.has(extension)
}

export function FileUploadSection({ orderNo, files, reservedSlotIds = [], onFilesChange, register, watch, setValue, error, onTitleClick }: FileUploadSectionProps) {
  const [activeTab, setActiveTab] = useState<'photos' | 'package' | 'links'>('photos')
  const [isDragging, setIsDragging] = useState(false)
  const [bulkUploadError, setBulkUploadError] = useState<string | null>(null)
  const bulkInputRef = useRef<HTMLInputElement>(null)
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

  const addBulkFiles = (selectedFiles: File[]) => {
    const supportedFiles = selectedFiles.filter(isSupportedBulkFile)
    const rejectedCount = selectedFiles.length - supportedFiles.length
    setBulkUploadError(rejectedCount > 0
      ? `${rejectedCount} unsupported file${rejectedCount === 1 ? '' : 's'} skipped. Use JPG, PNG, WEBP, PDF, STL, OBJ, or PLY.`
      : null)

    const occupiedSlots = new Set([...reservedSlotIds, ...Object.keys(files)])
    let nextIndex = 1
    supportedFiles.forEach((file) => {
      while (occupiedSlots.has(`bulk-file-${nextIndex}`)) nextIndex += 1
      const slotId = `bulk-file-${nextIndex}` as FileSlotId
      occupiedSlots.add(slotId)
      nextIndex += 1
      uploadFile(slotId, file)
    })
  }

  const photoFiles = Object.entries(files)
    .filter(([slotId, slotFile]) => slotId !== 'case-package' && Boolean(slotFile)) as Array<[FileSlotId, SlotFile]>
  const completedPhotoFiles = photoFiles.filter(([, slotFile]) => slotFile.status === 'success').length

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

        {activeTab === 'photos' && <div className="space-y-4">
          <input
            ref={bulkInputRef}
            type="file"
            multiple
            accept={BULK_FILE_ACCEPT}
            className="sr-only"
            onChange={(event) => {
              addBulkFiles(Array.from(event.target.files ?? []))
              event.target.value = ''
            }}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => bulkInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                bulkInputRef.current?.click()
              }
            }}
            onDragEnter={(event) => { event.preventDefault(); setIsDragging(true) }}
            onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
            onDragLeave={(event) => {
              event.preventDefault()
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setIsDragging(false)
              addBulkFiles(Array.from(event.dataTransfer.files))
            }}
            aria-label="Upload case photos and scan files"
            className={`flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed px-5 py-8 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-bg hover:border-primary hover:bg-primary/[0.03]'}`}
          >
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><UploadCloud className="h-6 w-6" aria-hidden /></span>
            <p className="text-sm font-semibold text-text">Drop all case files here</p>
            <p className="mt-1 text-xs text-text-muted">or click to select multiple files at once</p>
            <p className="mt-3 text-[11px] text-text-muted">JPG, PNG, WEBP, PDF, STL, OBJ, and PLY</p>
          </div>

          {bulkUploadError && <p role="alert" className="text-xs text-red-600">{bulkUploadError}</p>}

          {photoFiles.length > 0 && <div className="overflow-hidden rounded-card border border-border">
            <div className="flex items-center justify-between border-b border-border bg-bg px-3 py-2">
              <p className="text-xs font-semibold text-secondary">{photoFiles.length} file{photoFiles.length === 1 ? '' : 's'}</p>
              <p className="text-[11px] text-text-muted">{completedPhotoFiles} uploaded</p>
            </div>
            <div className="divide-y divide-border">
              {photoFiles.map(([slotId, slotFile]) => {
                const isUploading = slotFile.status === 'uploading'
                const isSuccess = slotFile.status === 'success'
                return <div key={slotId} className="flex min-w-0 items-center gap-3 px-3 py-2.5">
                  {slotFile.previewUrl ? <img src={slotFile.previewUrl} alt="" className="h-10 w-10 shrink-0 rounded object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-bg text-text-muted"><FileIcon className="h-4 w-4" aria-hidden /></span>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="truncate text-xs font-medium text-text">{slotFile.file.name}</p>{isSuccess && <Check className="h-3.5 w-3.5 shrink-0 text-green-600" aria-label="Uploaded" />}</div>
                    {isUploading && <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border"><div className="h-full bg-primary transition-all" style={{ width: `${slotFile.progress}%` }} /></div>}
                    {slotFile.status === 'error' && <p className="mt-1 truncate text-[10px] text-red-600">{slotFile.error ?? 'Upload failed'}</p>}
                  </div>
                  {slotFile.status === 'error' && <button type="button" onClick={() => uploadFile(slotId, slotFile.file)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-card text-primary hover:bg-primary/5" title="Retry upload"><RotateCcw className="h-3.5 w-3.5" /><span className="sr-only">Retry {slotFile.file.name}</span></button>}
                  {!isUploading && <button type="button" onClick={() => removeFile(slotId)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-card text-text-muted hover:bg-red-50 hover:text-red-600" title="Remove file"><X className="h-3.5 w-3.5" /><span className="sr-only">Remove {slotFile.file.name}</span></button>}
                </div>
              })}
            </div>
          </div>}
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
