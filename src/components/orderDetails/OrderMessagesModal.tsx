'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, X } from 'lucide-react'
import type { MessageAuthor } from '@/lib/orderMessages'

interface MessageItem {
  id: number
  author: MessageAuthor
  message: string
  createdAt: string
  isOwn: boolean
}

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
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', closeOnEscape)
    window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [loadMessages, onClose])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    const message = input.trim()
    if (!message || sending) return

    setSending(true)
    setError(null)
    try {
      const response = await fetch(`/api/orders/${orderId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const payload = await response.json().catch(() => ({})) as { message?: MessageItem; error?: string }
      if (!response.ok || !payload.message) throw new Error(payload.error ?? 'Unable to send message')
      const createdMessage = payload.message
      setMessages((current) => [...current, createdMessage])
      setInput('')
      inputRef.current?.focus()
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-messages-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="flex h-[min(720px,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-card border border-border bg-surface shadow-xl">
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
              <div className={`max-w-[82%] rounded-card border px-3 py-2 shadow-sm ${BUBBLE_STYLES[item.author]}`}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-[10px] font-bold uppercase">{item.author}</span>
                  <time className="text-[10px] opacity-65" dateTime={item.createdAt}>
                    {new Date(item.createdAt).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </time>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-5">{item.message}</p>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={sendMessage} className="border-t border-border bg-surface p-3">
          {error && <p role="alert" className="mb-2 text-xs text-red-600">{error}</p>}
          <div className="flex items-end gap-2">
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
              disabled={!input.trim() || sending}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              title="Send message"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send message</span>
            </button>
          </div>
          <p className="mt-1 text-right text-[10px] text-text-muted">{input.length}/2000</p>
        </form>
      </div>
    </div>
  )
}
