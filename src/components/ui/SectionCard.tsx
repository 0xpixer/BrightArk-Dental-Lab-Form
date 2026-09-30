'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'

interface SectionCardProps {
  title: string
  children: ReactNode
  id?: string
  className?: string
  onTitleClick?: () => void
  embedded?: boolean
}

export function SectionCard({ title, children, id, className = '', onTitleClick, embedded = false }: SectionCardProps) {
  return (
    <section
      id={id}
      className={embedded ? className : `rounded-card border border-border bg-surface p-4 md:p-6 ${className}`}
      aria-labelledby={id ? `${id}-heading` : undefined}
    >
      <h2
        id={id ? `${id}-heading` : undefined}
        className="mb-4 border-b border-border pb-3 text-base font-semibold text-text"
      >
        {onTitleClick ? (
          <button
            type="button"
            onClick={onTitleClick}
            className="flex w-full items-center justify-between text-left text-base font-semibold text-text transition-colors hover:text-text-muted focus:outline-none focus:ring-2 focus:ring-text/10"
            aria-label={`Collapse ${title}`}
            aria-expanded
          >
            <span>{title}</span>
            <MorphIcon icon={ChevronUp} hoverIcon={ChevronDown} className="h-4 w-4 text-text-muted" />
          </button>
        ) : (
          title
        )}
      </h2>
      {children}
    </section>
  )
}

export function TreatmentColumn({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <details
      className="group rounded-card border border-border bg-surface md:open:rounded-card"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none rounded-t-card border-b border-border bg-[#fafafa] px-3 py-2 text-sm font-semibold text-text marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between">
          {title}
          <MorphIcon icon={open ? ChevronUp : ChevronDown} className="h-4 w-4 text-text-muted" />
        </span>
      </summary>
      <div className="space-y-3 p-3">{children}</div>
    </details>
  )
}
