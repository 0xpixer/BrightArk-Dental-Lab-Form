'use client'

import { useCallback, useState } from 'react'
import { Download, Eye, FileIcon } from 'lucide-react'
import { getFilenameFromUrl, SLOT_FOLDER_MAP } from '@/lib/admin/fileSlots'
import { getFilePreviewKind } from '@/lib/filePreview'
import { FilePreviewModal, type PreviewFile } from './FilePreviewModal'

export function UploadedFileList({ files }: { files: Record<string, string> }) {
  const [preview, setPreview] = useState<PreviewFile | null>(null)
  const closePreview = useCallback(() => setPreview(null), [])

  return (
    <>
      <div className="space-y-2">
        {Object.entries(files).map(([slotId, url]) => {
          const filename = getFilenameFromUrl(url)
            ?? SLOT_FOLDER_MAP[slotId]?.filename
            ?? slotId.replace(/-/g, ' ')
          const kind = getFilePreviewKind(url)
          const rowClass = 'flex w-full min-w-0 items-center gap-2 rounded border border-border px-3 py-2 text-left text-sm text-text hover:bg-bg'

          return kind ? (
            <button key={slotId} type="button" onClick={() => setPreview({ url, filename, kind })} className={rowClass} title={`Preview ${filename}`}>
              <FileIcon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{filename}</span>
              <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </button>
          ) : (
            <a key={slotId} href={url} target="_blank" rel="noopener noreferrer" className={rowClass} title={`Download ${filename}`}>
              <FileIcon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{filename}</span>
              <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
            </a>
          )
        })}
      </div>

      {preview && <FilePreviewModal file={preview} onClose={closePreview} />}
    </>
  )
}
