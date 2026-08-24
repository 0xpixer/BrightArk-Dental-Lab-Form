'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { Download, RotateCcw, X } from 'lucide-react'
import type { FilePreviewKind } from '@/lib/filePreview'

const StlViewer = dynamic(() => import('./StlViewer'), {
  ssr: false,
  loading: () => <div className="grid min-h-[280px] place-items-center bg-bg text-sm text-text-muted sm:min-h-[480px]">Loading 3D viewer…</div>,
})

export interface PreviewFile {
  url: string
  filename: string
  kind: Exclude<FilePreviewKind, null>
}

export function FilePreviewModal({ file, onClose }: { file: PreviewFile; onClose: () => void }) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [resetSignal, setResetSignal] = useState(0)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${file.filename}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="flex max-h-[96vh] w-full max-w-5xl flex-col overflow-hidden rounded-card border border-border bg-surface sm:max-h-[92vh]">
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-border px-3 py-2 sm:px-4">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{file.filename}</p>
          <div className="flex shrink-0 items-center gap-1">
            {file.kind === 'stl' && (
              <button type="button" onClick={() => setResetSignal((value) => value + 1)} className="rounded p-2 text-text-muted hover:bg-bg hover:text-text" title="Reset 3D view">
                <RotateCcw className="h-4 w-4" aria-hidden />
                <span className="sr-only">Reset 3D view</span>
              </button>
            )}
            <a href={file.url} target="_blank" rel="noopener noreferrer" className="rounded p-2 text-text hover:bg-bg" title="Download file">
              <Download className="h-4 w-4" aria-hidden />
              <span className="sr-only">Download {file.filename}</span>
            </a>
            <button ref={closeButtonRef} type="button" onClick={onClose} className="rounded p-2 text-text-muted hover:bg-bg hover:text-text" title="Close preview">
              <X className="h-4 w-4" aria-hidden />
              <span className="sr-only">Close preview</span>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          {file.kind === 'image' ? (
            <div className="flex min-h-[280px] items-center justify-center bg-bg p-2 sm:min-h-[480px] sm:p-4">
              <img src={file.url} alt={file.filename} className="max-h-[78vh] max-w-full object-contain" />
            </div>
          ) : (
            <StlViewer url={file.url} filename={file.filename} resetSignal={resetSignal} />
          )}
        </div>
      </div>
    </div>
  )
}
