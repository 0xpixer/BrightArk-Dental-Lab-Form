'use client'

import { useCallback, useEffect } from 'react'
import { Info } from 'lucide-react'
import type { FileSlotId } from '@/types/orderForm'
import { SectionCard } from './ui/SectionCard'
import { FILE_SLOT_GROUPS } from './fileUpload/slotConfig'
import { UploadSlotCard, type SlotFile } from './fileUpload/UploadSlotCard'
import type { Dispatch, SetStateAction } from 'react'

export type FilesState = Partial<Record<FileSlotId, SlotFile>>

interface FileUploadSectionProps {
  orderNo: string
  files: FilesState
  onFilesChange: Dispatch<SetStateAction<FilesState>>
  fileErrors?: { upperModel?: string; lowerModel?: string }
}

function Tooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-flex">
      <button type="button" className="text-secondary" title={text}>
        <Info className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">{text}</span>
      </button>
    </span>
  )
}

function slotGridClass(heading: string, slotCount: number): string {
  if (heading === 'Oral Scans') return 'grid-cols-2'
  if (slotCount >= 3) return 'grid-cols-2 sm:grid-cols-3'
  return 'grid-cols-2'
}

export function FileUploadSection({ orderNo, files, onFilesChange, fileErrors }: FileUploadSectionProps) {
  const uploadFile = useCallback(
    async (slotId: FileSlotId, file: File) => {
      const existing = files[slotId]
      if (existing?.previewUrl) URL.revokeObjectURL(existing.previewUrl)

      const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined

      // Set uploading state immediately so the UI shows progress
      onFilesChange((prev) => ({
        ...prev,
        [slotId]: {
          file,
          previewUrl,
          progress: 0,
          status: 'uploading',
        },
      }))

      try {
        // Send file to our own API route — never directly to Vercel Blob
        // This avoids the CORS error caused by browser → blob.vercel-storage.com
        const formData = new FormData()
        formData.append('file', file)
        formData.append('slotName', slotId)
        formData.append('orderNo', orderNo)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
          // Do NOT set Content-Type header manually — the browser sets it
          // automatically with the correct multipart/form-data boundary
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Upload failed' }))
          throw new Error(err.error || 'Upload failed')
        }

        const blob = await response.json()

        onFilesChange((prev) => {
          const current = prev[slotId]
          if (!current) return prev
          return {
            ...prev,
            [slotId]: {
              ...current,
              progress: 100,
              blobUrl: blob.url,
              status: 'success',
              error: undefined,
            },
          }
        })
      } catch (error) {
        onFilesChange((prev) => {
          const current = prev[slotId]
          if (!current) return prev
          return {
            ...prev,
            [slotId]: {
              ...current,
              progress: 0,
              status: 'error',
              error: error instanceof Error ? error.message : 'Upload failed',
            },
          }
        })
      }
    },
    [files, onFilesChange, orderNo],
  )

  const removeFile = useCallback(
    (slotId: FileSlotId) => {
      const existing = files[slotId]
      if (existing?.previewUrl) URL.revokeObjectURL(existing.previewUrl)
      const next = { ...files }
      delete next[slotId]
      onFilesChange(next)
    },
    [files, onFilesChange],
  )

  useEffect(() => {
    return () => {
      Object.values(files).forEach((f) => {
        if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SectionCard title="Upload Files" id="file-upload" className="!border-accent/20">
      <div className="space-y-6">
        {FILE_SLOT_GROUPS.map((group) => (
          <div key={group.heading}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-accent">{group.heading}</h3>
              {group.tooltip && <Tooltip text={group.tooltip} />}
            </div>
            {group.note && (
              <p className="mb-2 text-xs text-text-muted">{group.note}</p>
            )}
            <div className={`grid gap-3 ${slotGridClass(group.heading, group.slots.length)}`}>
              {group.slots.map((slot) => (
                <UploadSlotCard
                  key={slot.id}
                  slot={slot}
                  slotFile={files[slot.id]}
                  hasError={
                    (slot.id === 'upper-model' && !!fileErrors?.upperModel) ||
                    (slot.id === 'lower-model' && !!fileErrors?.lowerModel)
                  }
                  onSelect={(file) => uploadFile(slot.id, file)}
                  onRemove={() => removeFile(slot.id)}
                  onRetry={() => {
                    const current = files[slot.id]
                    if (current?.file) uploadFile(slot.id, current.file)
                  }}
                />
              ))}
            </div>
            {group.slots.some((s) => s.id === 'upper-model') && fileErrors?.upperModel && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {fileErrors.upperModel}
              </p>
            )}
            {group.slots.some((s) => s.id === 'lower-model') && fileErrors?.lowerModel && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {fileErrors.lowerModel}
              </p>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  )
}
