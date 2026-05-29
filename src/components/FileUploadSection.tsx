import { useCallback, useEffect, useId, useState, type Dispatch, type SetStateAction } from 'react'
import { useDropzone } from 'react-dropzone'
import { FolderUp, Info } from 'lucide-react'
import type { FileSlotId } from '../types/orderForm'
import { SectionCard } from './ui/SectionCard'
import { FILE_SLOT_GROUPS, ALL_SLOTS } from './fileUpload/slotConfig'
import { UploadSlotCard, type SlotFile } from './fileUpload/UploadSlotCard'

export type FilesState = Partial<Record<FileSlotId, SlotFile>>

export interface UnassignedFile {
  id: string
  file: File
  previewUrl?: string
  progress: number
}

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
  const tipId = useId()
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="text-secondary"
        aria-describedby={tipId}
        title={text}
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">{text}</span>
      </button>
      <span id={tipId} role="tooltip" className="sr-only">
        {text}
      </span>
    </span>
  )
}

export function FileUploadSection({ files, onFilesChange, fileErrors }: FileUploadSectionProps) {
  const [unassigned, setUnassigned] = useState<UnassignedFile[]>([])

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

  const findFirstEmptySlot = useCallback(
    (file: File): FileSlotId | null => {
      const isScan = /\.(obj|ply|stl)$/i.test(file.name) || file.name.endsWith('.stl')
      const isImage = file.type.startsWith('image/')

      for (const slot of ALL_SLOTS) {
        if (files[slot.id]) continue
        if (isScan && slot.accept.includes('stl')) return slot.id
        if (isImage && slot.accept.includes('image')) return slot.id
      }
      for (const slot of ALL_SLOTS) {
        if (!files[slot.id]) return slot.id
      }
      return null
    },
    [files],
  )

  const handleIncomingFiles = useCallback(
    (incoming: File[]) => {
      incoming.forEach((file) => {
        const slotId = findFirstEmptySlot(file)
        if (slotId) {
          assignFile(slotId, file)
        } else {
          const id = `${Date.now()}-${Math.random()}`
          const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
          const entry: UnassignedFile = { id, file, previewUrl, progress: 0 }
          setUnassigned((prev) => [...prev, entry])
          simulateProgress((progress) => {
            setUnassigned((prev) =>
              prev.map((u) => (u.id === id ? { ...u, progress } : u)),
            )
          })
        }
      })
    },
    [assignFile, findFirstEmptySlot],
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: handleIncomingFiles,
    noClick: true,
    noKeyboard: true,
  })

  useEffect(() => {
    return () => {
      Object.values(files).forEach((f) => {
        if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl)
      })
      unassigned.forEach((u) => {
        if (u.previewUrl) URL.revokeObjectURL(u.previewUrl)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <SectionCard title="Upload Files" id="file-upload" className="!border-accent/20">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {FILE_SLOT_GROUPS.map((group) => (
            <div key={group.heading}>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-accent">{group.heading}</h3>
                {group.tooltip && <Tooltip text={group.tooltip} />}
              </div>
              {group.note && (
                <p className="mb-2 text-xs text-text-muted">{group.note}</p>
              )}
              <div
                className={`grid gap-3 ${
                  group.slots.length >= 3
                    ? 'grid-cols-2 sm:grid-cols-3'
                    : 'grid-cols-2'
                }`}
              >
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

        <div className="lg:col-span-1">
          <div
            {...getRootProps()}
            className={`flex h-full min-h-[280px] flex-col items-center justify-center rounded-card border-2 border-dashed p-6 text-center transition-all duration-brand ${
              isDragActive
                ? 'drag-active-pulse border-accent bg-accent/5'
                : 'border-accent/40 bg-[#F8F7FF] hover:border-accent'
            }`}
          >
            <input {...getInputProps()} />
            <FolderUp className="mb-4 h-16 w-16 text-accent" strokeWidth={1.25} aria-hidden />
            <p className="text-sm font-medium text-text">Drag Files to This Area, or</p>
            <button
              type="button"
              onClick={open}
              className="mt-1 text-sm font-medium text-accent underline underline-offset-2 transition-colors hover:text-accent/80"
            >
              Choose file to upload
            </button>
            <p className="mt-4 text-xs leading-relaxed text-text-muted">
              The image supports JPG/JPEG/PNG Format
              <br />
              The intraoral scan supports OBJ/PLY/STL Format
            </p>
          </div>
        </div>
      </div>

      {unassigned.length > 0 && (
        <div className="mt-6 rounded-card border border-accent/30 bg-accent/5 p-4">
          <h4 className="mb-3 text-sm font-semibold text-accent">Unassigned files</h4>
          <ul className="space-y-2">
            {unassigned.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="truncate text-text">{item.file.name}</span>
                <label className="sr-only" htmlFor={`assign-${item.id}`}>
                  Assign slot for {item.file.name}
                </label>
                <select
                  id={`assign-${item.id}`}
                  className="rounded border border-border bg-white px-2 py-1 text-xs"
                  defaultValue=""
                  onChange={(e) => {
                    const slotId = e.target.value as FileSlotId
                    if (!slotId) return
                    assignFile(slotId, item.file)
                    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
                    setUnassigned((prev) => prev.filter((u) => u.id !== item.id))
                  }}
                >
                  <option value="">Assign to slot…</option>
                  {ALL_SLOTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                {item.progress < 100 && (
                  <div className="h-1 flex-1 min-w-[80px] overflow-hidden rounded-full bg-border">
                    <div className="h-full bg-accent" style={{ width: `${item.progress}%` }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SectionCard>
  )
}
