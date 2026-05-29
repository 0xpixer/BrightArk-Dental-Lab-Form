import type { ReactNode } from 'react'

interface SectionCardProps {
  title: string
  children: ReactNode
  id?: string
  className?: string
}

export function SectionCard({ title, children, id, className = '' }: SectionCardProps) {
  return (
    <section
      id={id}
      className={`rounded-card border border-border bg-surface p-4 shadow-sm md:p-6 ${className}`}
      aria-labelledby={id ? `${id}-heading` : undefined}
    >
      <h2
        id={id ? `${id}-heading` : undefined}
        className="mb-4 border-b border-border pb-2 text-base font-semibold text-secondary"
      >
        {title}
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
  return (
    <details
      className="group rounded-card border border-border bg-surface shadow-sm md:open:rounded-card"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none rounded-t-card bg-secondary px-3 py-2 text-sm font-semibold text-white marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between">
          {title}
          <span className="text-xs opacity-80 md:hidden">Tap to expand</span>
        </span>
      </summary>
      <div className="space-y-3 p-3">{children}</div>
    </details>
  )
}
