'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Menu, X } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'

/** Off-canvas drawer state for the sidebar below the `md` breakpoint. Closes on navigation and Escape. */
export function useMobileDrawer(pathname: string) {
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey) }
  }, [open])
  return { open, setOpen }
}

/** Sidebar <aside> classes: a fixed drawer on phones, the original sticky rail from `md` up. */
export function sidebarAsideClass(open: boolean, collapsed: boolean) {
  return `fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-72 max-w-[85vw] shrink-0 flex-col border-r border-border bg-surface transition-transform duration-brand ${open ? 'translate-x-0 shadow-xl' : '-translate-x-full'} md:sticky md:top-0 md:z-auto md:h-screen md:max-w-none md:translate-x-0 md:shadow-none md:transition-[width] ${collapsed ? 'md:w-16' : 'md:w-60'}`
}

export function MobileTopBar({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  return <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface/95 px-2 backdrop-blur md:hidden">
    <button type="button" onClick={onOpen} aria-label="Open navigation" aria-expanded={open} className="grid h-11 w-11 place-items-center rounded-card text-text hover:bg-bg"><MorphIcon icon={Menu} className="h-5 w-5" /></button>
    <Image src="/Logo-SVG.svg" alt="BrightArk" width={135} height={36} className="h-9 w-auto" priority />
  </header>
}

export function MobileDrawerBackdrop({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return <div className="fixed inset-0 z-40 bg-black/40 md:hidden" aria-hidden="true" onClick={onClose} />
}

export function MobileDrawerClose({ onClose }: { onClose: () => void }) {
  return <button type="button" onClick={onClose} aria-label="Close navigation" className="grid h-11 w-11 shrink-0 place-items-center rounded-card text-text-muted hover:bg-bg hover:text-text md:hidden"><MorphIcon icon={X} className="h-5 w-5" /></button>
}
