'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Download } from 'lucide-react'

export default function ShareDownloadPage({ params }: { params: { token: string } }) {
  const [order, setOrder] = useState<{ orderNo: string; patientName: string; dateSent: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/share/${params.token}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setError(data.error ?? 'Link not found or expired')
        } else {
          setOrder(data.order)
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load link')
        setLoading(false)
      })
  }, [params.token])

  const handleDownload = () => {
    setDownloading(true)
    window.location.href = `/api/admin/share/${params.token}/download`
    setTimeout(() => setDownloading(false), 2000)
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-text-muted">Loading…</p>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4">
        <Image src="/Logo-SVG.svg" alt="BrightArk" width={140} height={40} className="mb-6" />
        <div className="rounded-card border border-red-200 bg-red-50 p-6 text-center">
          <h1 className="text-lg font-semibold text-red-800">
            {error ?? 'Link not found or expired'}
          </h1>
          <p className="mt-2 text-sm text-red-700">
            This share link may have expired or been removed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-4">
      <Image src="/Logo-SVG.svg" alt="BrightArk" width={160} height={48} className="mb-8" />

      <div className="w-full max-w-md rounded-card border border-border bg-surface p-8 shadow-lg text-center">
        <dl className="mb-6 space-y-3 text-left text-sm">
          <div>
            <dt className="text-text-muted">Order ID</dt>
            <dd className="font-semibold text-text">{order.orderNo}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Patient</dt>
            <dd className="font-medium">{order.patientName}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Submitted</dt>
            <dd>{formatDate(order.dateSent)}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-card bg-primary py-4 text-base font-semibold text-white hover:bg-[#e06d15] disabled:opacity-60"
        >
          <Download className="h-5 w-5" />
          {downloading ? 'Preparing download…' : 'Download Files'}
        </button>

        <p className="mt-6 text-xs text-text-muted">
          This link was shared by BrightArk. For questions contact{' '}
          <a href="mailto:cs@theBrightArk.com" className="text-primary underline">
            cs@theBrightArk.com
          </a>
        </p>
      </div>
    </div>
  )
}
