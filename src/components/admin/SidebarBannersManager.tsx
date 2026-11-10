'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { ArrowDown, ArrowUp, Check, CirclePlus, ImagePlus, Link2, LoaderCircle, Save, Trash2, UploadCloud } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'

interface Banner {
  id: number
  imageUrl: string
  linkUrl: string | null
  altText: string
  position: number
  isActive: boolean
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function SidebarBannersManager() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState<number | 'new' | 'order' | null>(null)
  const [newFile, setNewFile] = useState<File | null>(null)
  const [newLink, setNewLink] = useState('')
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadBanners = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/sidebar-banners')
      const payload = await readJson(response)
      if (!response.ok) throw new Error(payload.error ?? 'Unable to load banners.')
      setBanners(payload.banners ?? [])
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error) })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadBanners() }, [loadBanners])

  async function addBanner() {
    if (!newFile) return setMessage({ tone: 'error', text: 'Choose an image before adding the banner.' })
    if (!ACCEPTED_TYPES.includes(newFile.type)) return setMessage({ tone: 'error', text: 'Use a JPG, PNG, WebP or GIF image.' })
    if (newFile.size > 10 * 1024 * 1024) return setMessage({ tone: 'error', text: 'Banner images must be 10 MB or smaller.' })

    setPendingId('new')
    setMessage(null)
    try {
      const safeName = newFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const blob = await upload(`sidebar-banners/${crypto.randomUUID()}-${safeName}`, newFile, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      })
      const response = await fetch('/api/admin/sidebar-banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: blob.url, linkUrl: newLink.trim() || null }),
      })
      const payload = await readJson(response)
      if (!response.ok) throw new Error(payload.error ?? 'Unable to add banner.')
      setNewFile(null)
      setNewLink('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      setMessage({ tone: 'success', text: 'Banner added.' })
      await loadBanners()
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error) })
    } finally {
      setPendingId(null)
    }
  }

  async function saveBanner(banner: Banner) {
    setPendingId(banner.id)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/sidebar-banners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(banner),
      })
      const payload = await readJson(response)
      if (!response.ok) throw new Error(payload.error ?? 'Unable to save banner.')
      setBanners((current) => current.map((item) => item.id === banner.id ? payload.banner : item))
      setMessage({ tone: 'success', text: 'Banner saved.' })
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error) })
    } finally {
      setPendingId(null)
    }
  }

  async function replaceImage(banner: Banner, file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) return setMessage({ tone: 'error', text: 'Use a JPG, PNG, WebP or GIF image.' })
    if (file.size > 10 * 1024 * 1024) return setMessage({ tone: 'error', text: 'Banner images must be 10 MB or smaller.' })
    setPendingId(banner.id)
    setMessage(null)
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const blob = await upload(`sidebar-banners/${crypto.randomUUID()}-${safeName}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      })
      await saveBanner({ ...banner, imageUrl: blob.url })
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error) })
      setPendingId(null)
    }
  }

  async function deleteBanner(banner: Banner) {
    if (!window.confirm('Delete this sidebar banner?')) return
    setPendingId(banner.id)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/sidebar-banners', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: banner.id }),
      })
      const payload = await readJson(response)
      if (!response.ok) throw new Error(payload.error ?? 'Unable to delete banner.')
      setBanners((current) => current.filter((item) => item.id !== banner.id))
      setMessage({ tone: 'success', text: 'Banner deleted.' })
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error) })
    } finally {
      setPendingId(null)
    }
  }

  async function moveBanner(index: number, direction: -1 | 1) {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= banners.length) return
    const reordered = [...banners]
    ;[reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]]
    const positioned = reordered.map((banner, position) => ({ ...banner, position }))
    setBanners(positioned)
    setPendingId('order')
    setMessage(null)
    try {
      const responses = await Promise.all(positioned.map((banner) => fetch('/api/admin/sidebar-banners', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(banner),
      })))
      if (responses.some((response) => !response.ok)) throw new Error('Unable to update banner order.')
      setMessage({ tone: 'success', text: 'Banner order updated.' })
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error) })
      await loadBanners()
    } finally {
      setPendingId(null)
    }
  }

  function updateBanner(id: number, changes: Partial<Banner>) {
    setBanners((current) => current.map((banner) => banner.id === id ? { ...banner, ...changes } : banner))
  }

  return <div className="mx-auto max-w-5xl space-y-6">
    <header>
      <h1 className="text-xl font-semibold text-text">Sidebar Banners</h1>
      <p className="mt-1 text-sm text-text-muted">Manage up to three promotional banners shown below Account in the expanded sidebar.</p>
    </header>

    {message && <div role="status" className={`rounded-card border px-4 py-3 text-sm ${message.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{message.text}</div>}

    <section className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-semibold text-text">Active carousel</h2>
        <p className="mt-1 text-xs text-text-muted">Use a 3:1 image for the cleanest result. GIF animation is supported.</p>
      </div>
      {loading ? <div className="flex items-center gap-2 px-5 py-10 text-sm text-text-muted"><MorphIcon icon={LoaderCircle} className="h-4 w-4 animate-spin" /> Loading banners...</div>
        : banners.length === 0 ? <div className="px-5 py-10 text-center text-sm text-text-muted">No sidebar banners yet.</div>
          : <div className="divide-y divide-border">
            {banners.map((banner, index) => <div key={banner.id} className="grid gap-4 p-5 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-center">
              <div className="aspect-[3/1] overflow-hidden rounded-card border border-border bg-bg"><img src={banner.imageUrl} alt={banner.altText} className="h-full w-full object-cover" /></div>
              <div className="space-y-3">
                <label className="block"><span className="mb-1 block text-xs font-semibold text-text-muted">Destination link (optional)</span><div className="relative"><MorphIcon icon={Link2} className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" /><input type="url" value={banner.linkUrl ?? ''} onChange={(event) => updateBanner(banner.id, { linkUrl: event.target.value })} placeholder="https://..." className="h-10 w-full rounded-card border border-border bg-bg pl-9 pr-3 text-sm text-text outline-none focus:border-text" /></div></label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-text"><input type="checkbox" checked={banner.isActive} onChange={(event) => updateBanner(banner.id, { isActive: event.target.checked })} className="h-4 w-4 accent-primary" /> Show in sidebar</label>
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-text-muted hover:text-text"><MorphIcon icon={UploadCloud} className="h-4 w-4" /> Replace image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void replaceImage(banner, file); event.currentTarget.value = '' }} /></label>
                </div>
              </div>
              <div className="flex items-center gap-1 md:flex-col">
                <button type="button" onClick={() => void moveBanner(index, -1)} disabled={index === 0 || pendingId !== null} className="grid h-9 w-9 place-items-center rounded-card text-text-muted hover:bg-bg hover:text-text disabled:opacity-25" title="Move up"><MorphIcon icon={ArrowUp} className="h-4 w-4" /></button>
                <button type="button" onClick={() => void moveBanner(index, 1)} disabled={index === banners.length - 1 || pendingId !== null} className="grid h-9 w-9 place-items-center rounded-card text-text-muted hover:bg-bg hover:text-text disabled:opacity-25" title="Move down"><MorphIcon icon={ArrowDown} className="h-4 w-4" /></button>
                <button type="button" onClick={() => void saveBanner(banner)} disabled={pendingId !== null} className="grid h-9 w-9 place-items-center rounded-card text-text-muted hover:bg-bg hover:text-text disabled:opacity-40" title="Save banner"><MorphIcon icon={Save} hoverIcon={Check} className="h-4 w-4" /></button>
                <button type="button" onClick={() => void deleteBanner(banner)} disabled={pendingId !== null} className="grid h-9 w-9 place-items-center rounded-card text-text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-40" title="Delete banner"><MorphIcon icon={Trash2} className="h-4 w-4" /></button>
              </div>
            </div>)}
          </div>}
    </section>

    {banners.length < 3 && <section className="rounded-card border border-border bg-surface p-5">
      <div className="flex items-center gap-2"><MorphIcon icon={ImagePlus} className="h-5 w-5 text-primary" /><h2 className="font-semibold text-text">Add banner</h2></div>
      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <label className="block"><span className="mb-1 block text-xs font-semibold text-text-muted">Image or animated GIF</span><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setNewFile(event.target.files?.[0] ?? null)} className="block h-10 w-full rounded-card border border-border bg-bg px-3 py-2 text-xs text-text file:mr-3 file:border-0 file:bg-transparent file:text-xs file:font-semibold" /></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-text-muted">Destination link (optional)</span><input type="url" value={newLink} onChange={(event) => setNewLink(event.target.value)} placeholder="https://..." className="h-10 w-full rounded-card border border-border bg-bg px-3 text-sm text-text outline-none focus:border-text" /></label>
        <button type="button" onClick={() => void addBanner()} disabled={!newFile || pendingId !== null} className="inline-flex h-10 items-center justify-center gap-2 rounded-card bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"><MorphIcon icon={CirclePlus} hoverIcon={ImagePlus} className="h-4 w-4" />{pendingId === 'new' ? 'Uploading...' : 'Add banner'}</button>
      </div>
    </section>}
  </div>
}

async function readJson(response: Response): Promise<Record<string, any>> {
  const text = await response.text()
  if (!text) return {}
  try { return JSON.parse(text) as Record<string, any> } catch { return {} }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.'
}
