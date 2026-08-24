'use client'

import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { Check, FileIcon, RotateCcw, UploadCloud, X } from 'lucide-react'
import { CASE_FILE_ACCEPT, CASE_FILE_FORMAT_DESCRIPTION, isSupportedCaseFile } from '@/components/fileUpload/fileTypes'

interface QueueFile {
  slotId: string
  file: File
  progress: number
  status: 'uploading' | 'error'
  error?: string
  blobUrl?: string
}

interface AddOrderFilesProps {
  orderId: number
  orderNo: string
  existingSlotIds: string[]
  onFilesAdded: () => void | Promise<void>
  endpoint?: string
  slotPrefix?: 'bulk-file' | 'production-file'
  label?: string
}

export function AddOrderFiles({
  orderId,
  orderNo,
  existingSlotIds,
  onFilesAdded,
  endpoint = `/api/orders/${orderId}/files`,
  slotPrefix = 'bulk-file',
  label = 'Add files',
}: AddOrderFilesProps) {
  const [queue, setQueue] = useState<QueueFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isUploading = queue.some((entry) => entry.status === 'uploading')

  const updateQueueEntry = (slotId: string, update: Partial<QueueFile>) => {
    setQueue((current) => current.map((entry) => entry.slotId === slotId ? { ...entry, ...update } : entry))
  }

  const uploadEntries = async (entries: QueueFile[]) => {
    setMessage(null)
    const uploaded = await Promise.all(entries.map(async (entry) => {
      updateQueueEntry(entry.slotId, { status: 'uploading', progress: 0, error: undefined })
      if (entry.blobUrl) return { slotId: entry.slotId, url: entry.blobUrl }

      const safeName = entry.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
      try {
        const blob = await upload(`orders/${orderNo}/${entry.slotId}/${safeName}`, entry.file, {
          access: 'public',
          handleUploadUrl: '/api/upload',
          onUploadProgress: ({ percentage }) => updateQueueEntry(entry.slotId, { progress: percentage }),
        })
        updateQueueEntry(entry.slotId, { blobUrl: blob.url, progress: 100 })
        return { slotId: entry.slotId, url: blob.url }
      } catch (error) {
        updateQueueEntry(entry.slotId, {
          status: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : 'Upload failed',
        })
        return null
      }
    }))

    const completed = uploaded.filter((entry): entry is { slotId: string; url: string } => Boolean(entry))
    if (completed.length === 0) return

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUrls: Object.fromEntries(completed.map((entry) => [entry.slotId, entry.url])) }),
    })
    const result = await response.json().catch(() => ({})) as { error?: string }
    if (!response.ok) {
      completed.forEach((entry) => updateQueueEntry(entry.slotId, { status: 'error', progress: 0, error: result.error ?? 'Unable to attach file' }))
      return
    }

    await onFilesAdded()
    const completedIds = new Set(completed.map((entry) => entry.slotId))
    setQueue((current) => current.filter((entry) => !completedIds.has(entry.slotId)))
    setMessage(`${completed.length} file${completed.length === 1 ? '' : 's'} added`)
  }

  const addFiles = (selectedFiles: File[]) => {
    if (isUploading) return
    const supportedFiles = selectedFiles.filter(isSupportedCaseFile)
    const rejectedCount = selectedFiles.length - supportedFiles.length
    setSelectionError(rejectedCount > 0
      ? `${rejectedCount} unsupported file${rejectedCount === 1 ? '' : 's'} skipped.`
      : null)
    if (supportedFiles.length === 0) return

    const reserved = new Set([...existingSlotIds, ...queue.map((entry) => entry.slotId)])
    let seed = Date.now()
    const entries = supportedFiles.map((file) => {
      while (reserved.has(`${slotPrefix}-${seed}`)) seed += 1
      const entry: QueueFile = { slotId: `${slotPrefix}-${seed}`, file, progress: 0, status: 'uploading' }
      reserved.add(entry.slotId)
      seed += 1
      return entry
    })
    setQueue((current) => [...current, ...entries])
    void uploadEntries(entries)
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={CASE_FILE_ACCEPT}
        className="sr-only"
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []))
          event.target.value = ''
        }}
      />
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => { if (!isUploading) inputRef.current?.click() }}
        onKeyDown={(event) => {
          if (!isUploading && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragEnter={(event) => { event.preventDefault(); if (!isUploading) setIsDragging(true) }}
        onDragOver={(event) => { event.preventDefault(); if (!isUploading) setIsDragging(true) }}
        onDragLeave={(event) => {
          event.preventDefault()
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          addFiles(Array.from(event.dataTransfer.files))
        }}
        className={`flex min-h-28 flex-col items-center justify-center rounded-card border-2 border-dashed px-3 py-4 text-center focus:outline-none focus:ring-2 focus:ring-text/10 ${isUploading ? 'cursor-wait opacity-70' : 'cursor-pointer'} ${isDragging ? 'border-text bg-neutral-50' : 'border-border bg-bg hover:border-neutral-400'}`}
      >
        <UploadCloud className="h-5 w-5 text-text" aria-hidden />
        <p className="mt-1.5 text-xs font-semibold text-text">{label}</p>
        <p className="mt-0.5 text-[10px] text-text-muted">Drop files here or browse</p>
        <p className="mt-1.5 text-[9px] leading-4 text-text-muted">{CASE_FILE_FORMAT_DESCRIPTION}</p>
      </div>

      {selectionError && <p role="alert" className="mt-2 text-[10px] text-red-600">{selectionError}</p>}
      {message && <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-green-700"><Check className="h-3 w-3" />{message}</p>}

      {queue.length > 0 && <div className="mt-3 space-y-2">
        {queue.map((entry) => <div key={entry.slotId} className="flex min-w-0 items-center gap-2 rounded border border-border px-2 py-2">
          <FileIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-medium text-text">{entry.file.name}</p>
            {entry.status === 'uploading' && <div className="mt-1 h-1 overflow-hidden rounded-full bg-border"><div className="h-full bg-primary transition-all" style={{ width: `${entry.progress}%` }} /></div>}
            {entry.status === 'error' && <p className="mt-0.5 truncate text-[9px] text-red-600">{entry.error}</p>}
          </div>
          {entry.status === 'error' && <>
            <button type="button" onClick={() => void uploadEntries([entry])} className="text-text" title="Retry"><RotateCcw className="h-3.5 w-3.5" /><span className="sr-only">Retry {entry.file.name}</span></button>
            <button type="button" onClick={() => setQueue((current) => current.filter((item) => item.slotId !== entry.slotId))} className="text-text-muted hover:text-red-600" title="Remove"><X className="h-3.5 w-3.5" /><span className="sr-only">Remove {entry.file.name}</span></button>
          </>}
        </div>)}
      </div>}
    </div>
  )
}
