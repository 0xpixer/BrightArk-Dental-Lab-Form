'use client'

import { useEffect, useRef, useState } from 'react'
import { MorphIcon as MorphIconPrimitive } from 'morphicons/react'
import type { IconNode } from 'lucide'

interface MorphIconProps {
  icon: IconNode
  hoverIcon?: IconNode
  className?: string
  wrapperClassName?: string
  size?: number
  strokeWidth?: number
  label?: string
}

export function MorphIcon({
  icon,
  hoverIcon,
  className,
  wrapperClassName,
  size,
  strokeWidth = 2,
  label,
}: MorphIconProps) {
  const hostRef = useRef<HTMLSpanElement>(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    const interactive = host?.closest<HTMLElement>('button, a, [role="button"]')
    if (!interactive || !hoverIcon) return

    const activate = () => setHovered(true)
    const deactivatePointer = () => setHovered(interactive.matches(':focus-visible, :focus-within'))
    const deactivateFocus = () => setHovered(interactive.matches(':hover'))

    interactive.addEventListener('pointerenter', activate)
    interactive.addEventListener('pointerleave', deactivatePointer)
    interactive.addEventListener('focusin', activate)
    interactive.addEventListener('focusout', deactivateFocus)

    return () => {
      interactive.removeEventListener('pointerenter', activate)
      interactive.removeEventListener('pointerleave', deactivatePointer)
      interactive.removeEventListener('focusin', activate)
      interactive.removeEventListener('focusout', deactivateFocus)
    }
  }, [hoverIcon])

  return (
    <span ref={hostRef} className={`inline-flex shrink-0 pointer-events-none ${wrapperClassName ?? ''}`}>
      <MorphIconPrimitive
        icon={hovered && hoverIcon ? hoverIcon : icon}
        spring="snappy"
        reducedMotion="user"
        className={className}
        size={size}
        strokeWidth={strokeWidth}
        label={label}
      />
    </span>
  )
}
