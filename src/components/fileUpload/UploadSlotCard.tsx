'use client'

import { useCallback, useRef } from 'react'
import { Check, X, RotateCcw } from 'lucide-react'
import type { FileSlotConfig } from './slotConfig'
import { SlotIcon } from './SlotIcon'

export interface SlotFile {
  file: File
  previewUrl?: string
  progress: number
  blobUrl?: string
  status: 'uploading' | 'success' | 'error'
  error?: string
}

interface UploadSlotCardProps {
  slot: FileSlotConfig
  slotFile?: SlotFile
  hasError?: boolean
  onSelect: (file: File) => void
  onRemove: () => void
  onRetry: () => void
}

export function UploadSlotCard({
  slot,
  slotFile,
  hasError,
  onSelect,
  onRemove,
  onRetry,
}: UploadSlotCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const openPicker = useCallback(() => {
    if (slotFile?.status === 'uploading') return
    inputRef.current?.click()
  }, [slotFile?.status])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openPicker()
    }
  }

  const isImage = slotFile?.file.type.startsWith('image/')
  const isUploading = slotFile?.status === 'uploading'
  const isSuccess = slotFile?.status === 'success'
  const isError = slotFile?.status === 'error'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={handleKeyDown}
      aria-label={`Upload ${slot.label}${slot.required ? ', required' : ''}`}
      className={`group relative flex flex-col items-center rounded-card border-2 border-dashed bg-bg p-3 transition-all duration-brand ease-in-out hover:scale-[1.02] hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 ${
        hasError
          ? 'border-red-400'
          : isSuccess
            ? 'border-green-400'
            : isError
              ? 'border-red-400'
              : slotFile
                ? 'border-accent/50'
                : 'border-border hover:border-primary'
      } ${isUploading ? 'pointer-events-none' : ''}`}
    >
      {slot.formatBadge && !slotFile && (
        <span className="absolute right-2 top-2 rounded bg-border px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
          {slot.formatBadge}
        </span>
      )}

      {isSuccess && (
        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
          <Check className="h-3 w-3" aria-hidden />
        </span>
      )}

      {isError && (
        <span className="absolute right-2 top-2 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
          Failed
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={slot.accept}
        disabled={isUploading}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onSelect(file)
          e.target.value = ''
        }}
      />

      {slotFile ? (
        <div className="relative w-full">
          {isImage && slotFile.previewUrl ? (
            <img
              src={slotFile.previewUrl}
              alt=""
              className="mx-auto h-20 w-full rounded object-cover"
            />
          ) : (
            <div className="flex h-20 items-center justify-center rounded bg-white text-xs text-text-muted">
              {slotFile.file.name.split('.').pop()?.toUpperCase()}
            </div>
          )}
          {!isUploading && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600"
              aria-label={`Remove ${slot.label}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <p className="mt-2 truncate text-center text-[10px] text-text">{slotFile.file.name}</p>
          {(isUploading || (slotFile.progress > 0 && slotFile.progress < 100)) && (
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full bg-accent transition-all duration-brand"
                style={{ width: `${slotFile.progress}%` }}
              />
            </div>
          )}
          {isError && (
            <div className="mt-2 flex flex-col items-center gap-1">
              <p className="text-center text-[10px] text-red-600">{slotFile.error ?? 'Upload failed'}</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onRetry()
                }}
                className="inline-flex items-center gap-1 rounded border border-red-300 px-2 py-0.5 text-[10px] font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                Retry
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <SlotIcon type={slot.icon} />
          <p className="mt-2 text-center text-xs font-medium text-text">
            {slot.label}
            {slot.required && <span className="text-red-500"> *</span>}
          </p>
        </>
      )}
    </div>
  )
}
