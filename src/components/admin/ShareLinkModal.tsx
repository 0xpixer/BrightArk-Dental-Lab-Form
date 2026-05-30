'use client'

import { useState } from 'react'
import { X, Copy, Check } from 'lucide-react'

interface ShareLinkModalProps {
  orderId: number
  onClose: () => void
}

export function ShareLinkModal({ orderId, onClose }: ShareLinkModalProps) {
  const [expiryDays, setExpiryDays] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [downloadCount, setDownloadCount] = useState(0)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiryDays }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to generate link')
      setShareUrl(data.shareUrl)
      setDownloadCount(data.downloadCount ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate link')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-card bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Shareable Download Link</h2>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!shareUrl ? (
          <>
            <p className="mb-3 text-sm text-text-muted">Set link expiry (optional):</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {[
                { label: '7 days', value: 7 },
                { label: '30 days', value: 30 },
                { label: 'Never', value: null },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setExpiryDays(opt.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    expiryDays === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-text-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="w-full rounded-card bg-primary py-2.5 text-sm font-semibold text-white hover:bg-[#e06d15] disabled:opacity-60"
            >
              {loading ? 'Generating…' : 'Generate Link'}
            </button>
          </>
        ) : (
          <>
            <div className="mb-3 rounded-card border border-border bg-bg p-3">
              <p className="break-all text-sm text-text">{shareUrl}</p>
            </div>
            <p className="mb-3 text-xs text-text-muted">Downloads: {downloadCount}</p>
            <button
              type="button"
              onClick={copyLink}
              className="flex w-full items-center justify-center gap-2 rounded-card border border-secondary py-2.5 text-sm font-semibold text-secondary hover:bg-secondary/5"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
