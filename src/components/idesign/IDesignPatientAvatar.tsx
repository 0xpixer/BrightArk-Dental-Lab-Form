'use client'

import { useState } from 'react'
import { UserRound } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'

type PatientFiles = Record<string, Array<{ url: string; name: string }>> | null

export function IDesignPatientAvatar({ name, files }: { name: string; files: PatientFiles }) {
  const [failed, setFailed] = useState(false)
  const source = files?.['frontal-view']?.[0]?.url

  if (!source || failed) {
    return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-bg text-text-muted"><MorphIcon icon={UserRound} className="h-5 w-5" /></span>
  }

  return <img src={source} alt={`${name} frontal view`} onError={() => setFailed(true)} className="h-10 w-10 shrink-0 rounded-full border border-border object-cover" />
}
