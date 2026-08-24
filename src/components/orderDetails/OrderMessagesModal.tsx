'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { ImagePlus, LoaderCircle, MessageCircle, Send, X } from 'lucide-react'
import type { MessageAuthor } from '@/lib/orderMessages'

interface MessageItem {
  id: number
  author: MessageAuthor
  message: string | null
  imageUrl: string | null
  imageName: string | null
  createdAt: string
  isOwn: boolean
}

interface PendingImage {
  file: File
  previewUrl: string
}

const MAX_CHAT_IMAGE_SIZE = 15 * 1024 * 1024
const CHAT_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

const BUBBLE_STYLES: Record<MessageAuthor, string> = {
  Doctor: 'border-green-200 bg-green-100 text-green-950',
  Lab: 'border-orange-200 bg-orange-100 text-orange-950',
  Admin: 'border-blue-200 bg-blue-100 text-blue-950',
}

export function OrderMessagesModal({ orderId, orderNo, onClose }: { orderId: number; orderNo: string; onClose: () => void }) {
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null)
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const loadMessages = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const response = await fetch(`/api/orders/${orderId}/messages`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({})) as { messages?: MessageItem[]; error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'Unable to load messages')
      setMessages(payload.messages ?? [])
      if (!silent) setError(null)
    } catch (loadError) {
      if (!silent) setError(loadError instanceof Error ? loadError.message : 'Unable to load messages')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void loadMessages()
    const interval = window.setInterval(() => void loadMessages(true), 15000)
    return () => window.clearInterval(interval)
  }, [loadMessages])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (previewImage) setPreviewImage(null)
      else onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onClose, previewImage])

  useEffect(() => {
    if (!pendingImage) return
    return () => URL.revokeObjectURL(pendingImage.previewUrl)
  }, [pendingImage])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    const message = input.trim()
    if ((!message && !pendingImage) || sending) return

    setSending(true)
    setUploadProgress(0)
    setError(null)
    try {
      let imageUrl: string | undefined
      let imageName: string | undefined
      if (pendingImage) {
        const safeName = pendingImage.file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
        const blob = await upload(`orders/${orderNo}/messages/${crypto.randomUUID()}-${safeName}`, pendingImage.file, {
          access: 'public',
          handleUploadUrl: '/api/upload',
          onUploadProgress: ({ percentage }) => setUploadProgress(percentage),
        })
        imageUrl = blob.url
        imageName = pendingImage.file.name
      }

      const response = await fetch(`/api/orders/${orderId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, imageUrl, imageName }),
      })
      const payload = await response.json().catch(() => ({})) as { message?: MessageItem; error?: string }
      if (!response.ok || !payload.message) throw new Error(payload.error ?? 'Unable to send message')
      const createdMessage = payload.message
      setMessages((current) => [...current, createdMessage])
      setInput('')
      setPendingImage(null)
      setUploadProgress(0)
      inputRef.current?.focus()
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send message')
    } finally {
      setSending(false)
    }
  }

  const selectImage = (file: File | undefined) => {
    if (!file) return
    if (!CHAT_IMAGE_TYPES.has(file.type)) {
      setError('Choose a JPG, PNG, or WebP image')
      return
    }
    if (file.size > MAX_CHAT_IMAGE_SIZE) {
      setError('Image must be 15 MB or smaller')
      return
    }
    setError(null)
    setPendingImage({ file, previewUrl: URL.createObjectURL(file) })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-messages-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="flex h-[min(720px,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-card border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
              <MessageCircle className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 id="order-messages-title" className="text-sm font-semibold text-text">Messages</h2>
              <p className="truncate text-xs text-text-muted">Order {orderNo}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded p-2 text-text-muted hover:bg-bg hover:text-text" title="Close messages">
            <X className="h-4 w-4" />
            <span className="sr-only">Close messages</span>
          </button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-bg/60 px-4 py-4" aria-live="polite">
          {loading ? (
            <p className="py-8 text-center text-sm text-text-muted">Loading messages...</p>
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <MessageCircle className="mb-2 h-7 w-7 text-text-muted" aria-hidden />
              <p className="text-sm font-medium text-text">No messages yet</p>
              <p className="mt-1 text-xs text-text-muted">Start the conversation about this order.</p>
            </div>
          ) : messages.map((item) => (
            <div key={item.id} className={`flex ${item.isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[82%] rounded-card border px-3 py-2 ${BUBBLE_STYLES[item.author]}`}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold uppercase">{item.author}</span>
                  <time className="text-[10px] opacity-65" dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </time>
                </div>
                {item.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setPreviewImage({ url: item.imageUrl!, name: item.imageName ?? 'Message image' })}
                    className="block overflow-hidden rounded border border-black/10 focus:outline-none focus:ring-2 focus:ring-green-500"
                    title="Open image preview"
                  >
                    <img src={item.imageUrl} alt={item.imageName ?? 'Message image'} className="max-h-64 w-full object-contain" />
                  </button>
                )}
                {item.message && <p className={`whitespace-pre-wrap break-words text-sm leading-5 ${item.imageUrl ? 'mt-2' : ''}`}>{item.message}</p>}
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={sendMessage} className="border-t border-border bg-surface p-3">
          {error && <p role="alert" className="mb-2 text-xs text-red-600">{error}</p>}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="sr-only"
            onChange={(event) => {
              selectImage(event.target.files?.[0])
              event.target.value = ''
            }}
          />
          {pendingImage && (
            <div className="mb-2 flex items-center gap-2 rounded-card border border-border bg-bg p-2">
              <img src={pendingImage.previewUrl} alt="Selected attachment" className="h-12 w-12 shrink-0 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-text">{pendingImage.file.name}</p>
                <p className="text-[10px] text-text-muted">{(pendingImage.file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
              <button type="button" onClick={() => setPendingImage(null)} disabled={sending} className="rounded p-1.5 text-text-muted hover:bg-surface hover:text-red-600" title="Remove image">
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Remove image</span>
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={sending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-green-700 hover:border-green-500 hover:bg-green-50 disabled:opacity-50"
              title="Attach picture"
            >
              <ImagePlus className="h-4 w-4" />
              <span className="sr-only">Attach picture</span>
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }}
              maxLength={2000}
              rows={2}
              placeholder="Write a message..."
              className="max-h-32 min-h-11 flex-1 resize-y rounded-card border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100"
            />
            <button
              type="submit"
              disabled={(!input.trim() && !pendingImage) || sending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              title="Send message"
            >
              {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Send message</span>
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-text-muted">
            <span>{sending && pendingImage ? `Uploading ${Math.round(uploadProgress)}%` : 'JPG, PNG or WebP up to 15 MB'}</span>
            <span>{input.length}/2000</span>
          </div>
        </form>
      </div>

      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${previewImage.name}`}
          onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewImage(null) }}
        >
          <div className="relative max-h-[92vh] max-w-5xl">
            <img src={previewImage.url} alt={previewImage.name} className="max-h-[88vh] max-w-full object-contain" />
            <button type="button" onClick={() => setPreviewImage(null)} className="absolute right-2 top-2 rounded-full bg-black/70 p-2 text-white hover:bg-black" title="Close image preview">
              <X className="h-5 w-5" />
              <span className="sr-only">Close image preview</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
