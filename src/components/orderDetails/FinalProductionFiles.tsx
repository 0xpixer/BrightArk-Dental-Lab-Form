'use client'

import { useEffect, useState } from 'react'
import { Download, ExternalLink, FileIcon, X } from 'lucide-react'
import { getFilenameFromUrl } from '@/lib/admin/fileSlots'
import { AddOrderFiles } from './AddOrderFiles'

interface FinalProductionFilesProps {
  orderId: number
  orderNo: string
  files: Record<string, string>
  canUpload: boolean
  onFilesAdded?: () => void | Promise<void>
}

const IMAGE_FILE = /\.(?:jpe?g|png|gif|webp)$/i

function isImageUrl(url: string) {
  const filename = getFilenameFromUrl(url)
  return Boolean(filename && IMAGE_FILE.test(filename))
}

export function FinalProductionFiles({ orderId, orderNo, files, canUpload, onFilesAdded }: FinalProductionFilesProps) {
  const [preview, setPreview] = useState<{ url: string; filename: string } | null>(null)
  const entries = Object.entries(files)

  useEffect(() => {
    if (!preview) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreview(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [preview])

  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="mb-3 border-b border-border pb-2 text-sm font-semibold text-secondary">Final Production Files</h2>
      <div className="space-y-2">
        {entries.map(([slotId, url]) => {
          const filename = getFilenameFromUrl(url) ?? slotId
          const image = isImageUrl(url)
          const rowClass = 'flex w-full min-w-0 items-center gap-2 rounded border border-border px-3 py-2 text-left text-sm text-text hover:bg-bg'

          return image ? (
            <button key={slotId} type="button" onClick={() => setPreview({ url, filename })} className={rowClass}>
              <FileIcon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{filename}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </button>
          ) : (
            <a key={slotId} href={url} target="_blank" rel="noopener noreferrer" className={rowClass}>
              <FileIcon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{filename}</span>
              <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </a>
          )
        })}
        {entries.length === 0 && <p className="text-sm text-text-muted">No final production files yet.</p>}
      </div>

      {canUpload && onFilesAdded && (
        <AddOrderFiles
          orderId={orderId}
          orderNo={orderNo}
          existingSlotIds={Object.keys(files)}
          onFilesAdded={onFilesAdded}
          endpoint={`/api/admin/orders/${orderId}/production-files`}
          slotPrefix="production-file"
          label="Upload final production files"
        />
      )}

      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${preview.filename}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null) }}
        >
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-card border border-border bg-surface p-4">
            <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold text-text">{preview.filename}</p>
              <div className="flex shrink-0 items-center gap-2">
                <a href={preview.url} target="_blank" rel="noopener noreferrer" className="rounded p-2 text-text hover:bg-bg" title="Download file">
                  <Download className="h-4 w-4" />
                  <span className="sr-only">Download {preview.filename}</span>
                </a>
                <button type="button" onClick={() => setPreview(null)} className="rounded p-2 text-text-muted hover:bg-bg hover:text-text" title="Close preview">
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close preview</span>
                </button>
              </div>
            </div>
            <img src={preview.url} alt={preview.filename} className="min-h-0 max-h-[80vh] w-full object-contain" />
          </div>
        </div>
      )}
    </section>
  )
}
