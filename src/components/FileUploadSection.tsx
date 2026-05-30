import { useCallback, useEffect } from 'react'
import { Info } from 'lucide-react'
import type { FileSlotId } from '../types/orderForm'
import { SectionCard } from './ui/SectionCard'
import { FILE_SLOT_GROUPS } from './fileUpload/slotConfig'
import { UploadSlotCard, type SlotFile } from './fileUpload/UploadSlotCard'
import type { Dispatch, SetStateAction } from 'react'

export type FilesState = Partial<Record<FileSlotId, SlotFile>>

interface FileUploadSectionProps {
  files: FilesState
  onFilesChange: Dispatch<SetStateAction<FilesState>>
  fileErrors?: { upperModel?: string; lowerModel?: string }
}

function simulateProgress(setProgress: (n: number) => void) {
  let p = 0
  const interval = setInterval(() => {
    p += 15 + Math.random() * 20
    if (p >= 100) {
      setProgress(100)
      clearInterval(interval)
    } else {
      setProgress(Math.min(p, 95))
    }
  }, 120)
  return () => clearInterval(interval)
}

function createSlotFile(
  file: File,
  onFilesChange: Dispatch<SetStateAction<FilesState>>,
  slotId: FileSlotId,
) {
  const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
  const slotFile: SlotFile = { file, previewUrl, progress: 0 }
  onFilesChange((prev) => ({ ...prev, [slotId]: slotFile }))

  simulateProgress((progress) => {
    onFilesChange((prev) => {
      const current = prev[slotId]
      if (!current) return prev
      return { ...prev, [slotId]: { ...current, progress } }
    })
  })
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

export function FileUploadSection({ files, onFilesChange, fileErrors }: FileUploadSectionProps) {
  const assignFile = useCallback(
    (slotId: FileSlotId, file: File) => {
      const existing = files[slotId]
      if (existing?.previewUrl) URL.revokeObjectURL(existing.previewUrl)
      createSlotFile(file, onFilesChange, slotId)
    },
    [files, onFilesChange],
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
                  onSelect={(file) => assignFile(slot.id, file)}
                  onRemove={() => removeFile(slot.id)}
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
