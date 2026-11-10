'use client'

import { useState } from 'react'
import { LoaderCircle } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'

const DEFAULT_ANATOMY_URL = 'https://brightark-dental-anatomy.vercel.app'

export function DentalAnatomyFrame() {
  const [loading, setLoading] = useState(true)
  const anatomyUrl = process.env.NEXT_PUBLIC_DENTAL_ANATOMY_URL || DEFAULT_ANATOMY_URL

  return (
    <section className="dental-anatomy-frame relative h-[100dvh] min-h-[620px] overflow-hidden bg-surface">
      {loading && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-bg" role="status" aria-live="polite">
          <div className="text-center">
            <MorphIcon icon={LoaderCircle} className="mx-auto h-6 w-6 animate-spin text-primary" />
            <p className="mt-3 text-sm font-medium text-text">Loading 3D dental anatomy</p>
            <p className="mt-1 text-xs text-text-muted">Preparing the interactive models...</p>
          </div>
        </div>
      )}

      <iframe
        src={anatomyUrl}
        title="3D Dental Anatomy"
        className="h-full w-full border-0 bg-bg"
        allow="fullscreen"
        allowFullScreen
        onLoad={() => setLoading(false)}
      />
    </section>
  )
}
