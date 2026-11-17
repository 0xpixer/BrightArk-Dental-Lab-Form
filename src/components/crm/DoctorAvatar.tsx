'use client'

import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { Camera, ImagePlus, Trash2 } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'

const SIZES = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-16 w-16 text-lg',
}

function initials(name: string) {
  const words = name.replace(/^(dr|drg|dr\.)\.?\s+/i, '').split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase() || '?'
}

export function DoctorAvatar({ name, url, size = 'md' }: { name: string; url: string | null; size?: keyof typeof SIZES }) {
  const [broken, setBroken] = useState(false)
  if (url && !broken) {
    // eslint-disable-next-line @next/next/no-img-element -- Blob URLs; no image optimisation needed for small avatars
    return <img src={url} alt="" onError={() => setBroken(true)} className={`${SIZES[size]} shrink-0 rounded-full border border-border bg-bg object-cover`} />
  }
  return <span aria-hidden className={`${SIZES[size]} grid shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary`}>{initials(name)}</span>
}

/** Downscales to a 512px square-ish WebP so avatars stay small (phones upload 5–10 MB photos). */
async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not read this image')), 'image/webp', 0.85))
}

export async function uploadDoctorAvatar(file: File, name: string) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file')
  const blob = await shrinkImage(file).catch(() => file)
  if (blob.size > 5 * 1024 * 1024) throw new Error('Photo must be under 5 MB')
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'doctor'
  const extension = blob.type === 'image/webp' ? 'webp' : file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const result = await upload(`crm-avatars/${slug}.${extension}`, blob, { access: 'public', handleUploadUrl: '/api/upload', contentType: blob.type || file.type })
  return result.url
}

/**
 * Avatar with a photo picker. `compact` (table cells) shows a camera badge on hover;
 * the full variant (sheets, add form) adds Upload/Remove buttons.
 */
export function AvatarPicker({ name, url, onChange, onError, compact = false }: {
  name: string
  url: string | null
  onChange: (url: string | null) => void
  onError: (message: string) => void
  compact?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function pick(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      onChange(await uploadDoctorAvatar(file, name))
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Photo upload failed')
    } finally {
      setUploading(false)
      if (input.current) input.current.value = ''
    }
  }

  const fileInput = <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void pick(event.target.files?.[0])} />

  if (compact) {
    return (
      <button type="button" onClick={() => input.current?.click()} disabled={uploading} title={url ? 'Change photo' : 'Add photo'} aria-label={`${url ? 'Change' : 'Add'} photo for ${name}`} className="group/avatar relative mt-0.5 shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text/20">
        <DoctorAvatar name={name} url={url} size="sm" />
        <span className={`absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white transition-opacity ${uploading ? 'opacity-100' : 'opacity-0 group-hover/avatar:opacity-100 group-focus-visible/avatar:opacity-100'}`}>
          {uploading ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <MorphIcon icon={Camera} className="h-3.5 w-3.5" />}
        </span>
        {fileInput}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <DoctorAvatar name={name || '?'} url={url} size="lg" />
        {uploading && <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45"><span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" /></span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => input.current?.click()} disabled={uploading} className="inline-flex h-11 items-center gap-2 rounded-card bg-text px-3 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-40 md:h-8"><MorphIcon icon={url ? Camera : ImagePlus} className="h-3.5 w-3.5" />{uploading ? 'Uploading…' : url ? 'Change photo' : 'Add photo'}</button>
        {url && !uploading && <button type="button" onClick={() => onChange(null)} className="inline-flex h-11 items-center gap-2 rounded-card border border-border px-3 text-xs font-medium text-text-muted hover:bg-bg md:h-8"><MorphIcon icon={Trash2} className="h-3.5 w-3.5" />Remove</button>}
      </div>
      {fileInput}
    </div>
  )
}
