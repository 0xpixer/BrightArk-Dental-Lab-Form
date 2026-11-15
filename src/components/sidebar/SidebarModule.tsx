'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ChevronDown, ChevronRight, ChevronUp, type IconNode } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'

export interface SidebarModuleItem { href: string; label: string; icon: IconNode; hoverIcon: IconNode }

const CLOSE_DELAY_MS = 160

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)')
    const update = () => setDesktop(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return desktop
}

/**
 * A sidebar module (e.g. "iDesign | Clear Aligners") with its child links.
 * Expanded sidebar and mobile drawer: children open inline below the module.
 * Collapsed desktop rail: children appear in a labelled flyout menu beside the icon,
 * so a child link is never mistaken for a top-level item.
 */
export function SidebarModule({ id, label, icon, items, open, onToggle, active, collapsed, isItemActive, pathname }: {
  id: string
  label: string
  icon: ReactNode
  items: SidebarModuleItem[]
  open: boolean
  onToggle: () => void
  active: boolean
  collapsed: boolean
  isItemActive: (href: string) => boolean
  pathname: string
}) {
  const desktop = useIsDesktop()
  const rail = collapsed && desktop
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [flyoutOpen, setFlyoutOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const menuId = `sidebar-flyout-${id}`

  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current = null }
  const show = useCallback(() => { cancelClose(); setFlyoutOpen(true) }, [])
  const scheduleClose = () => { cancelClose(); closeTimer.current = setTimeout(() => setFlyoutOpen(false), CLOSE_DELAY_MS) }

  // Place the flyout next to the icon, kept inside the viewport.
  useLayoutEffect(() => {
    if (!flyoutOpen || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const menuHeight = menuRef.current?.offsetHeight ?? 160
    setPosition({ left: rect.right + 10, top: Math.max(8, Math.min(rect.top - 6, window.innerHeight - menuHeight - 8)) })
  }, [flyoutOpen])

  useEffect(() => { setFlyoutOpen(false) }, [pathname, rail])

  useEffect(() => {
    if (!flyoutOpen) return
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setFlyoutOpen(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setFlyoutOpen(false); buttonRef.current?.focus() } }
    const onScroll = () => setFlyoutOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onScroll)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onScroll) }
  }, [flyoutOpen])

  useEffect(() => () => cancelClose(), [])

  const focusFirstItem = () => requestAnimationFrame(() => menuRef.current?.querySelector<HTMLAnchorElement>('a')?.focus())

  // Highlight: rail shows where you are (module containing the current page); expanded shows what is open.
  const highlighted = rail ? active : open
  const buttonClass = highlighted
    ? 'bg-primary text-white'
    : rail && flyoutOpen ? 'bg-bg text-text' : 'text-text-muted hover:bg-bg hover:text-text'

  return (
    <div>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { if (rail) { if (flyoutOpen) setFlyoutOpen(false); else { show(); focusFirstItem() } } else onToggle() }}
        onMouseEnter={rail ? show : undefined}
        onMouseLeave={rail ? scheduleClose : undefined}
        onKeyDown={(event) => { if (rail && event.key === 'ArrowRight') { event.preventDefault(); show(); focusFirstItem() } }}
        className={`relative flex h-10 w-full items-center justify-start gap-3 rounded-card px-3 text-sm font-semibold transition-colors max-md:h-11 ${collapsed ? 'md:justify-center md:px-2' : ''} ${buttonClass}`}
        aria-expanded={rail ? flyoutOpen : open}
        aria-haspopup={rail ? 'menu' : undefined}
        aria-controls={rail && flyoutOpen ? menuId : undefined}
        title={rail ? undefined : label}
      >
        {icon}
        <span className={`min-w-0 flex-1 truncate text-left ${collapsed ? 'md:hidden' : ''}`}>{label}</span>
        <span className={`inline-flex ${collapsed ? 'md:hidden' : ''}`}><MorphIcon icon={open ? ChevronUp : ChevronDown} className="h-4 w-4" /></span>
        {/* Small corner chevron hints that the collapsed icon opens a menu. */}
        {collapsed && <span className={`pointer-events-none absolute bottom-1 right-1 hidden md:block ${highlighted ? 'text-white/80' : 'text-text-muted/70'}`} aria-hidden><svg viewBox="0 0 6 6" className="h-1.5 w-1.5" fill="currentColor"><path d="M6 0v6H0z" /></svg></span>}
      </button>

      {/* Inline children: expanded sidebar, and the mobile drawer (which always shows labels). */}
      {open && (
        <div className={`ml-5 mt-1 space-y-1 border-l border-border pl-2 ${collapsed ? 'md:hidden' : ''}`}>
          {items.map((item) => <ChildLink key={item.href} item={item} active={isItemActive(item.href)} />)}
        </div>
      )}

      {rail && flyoutOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onMouseEnter={show}
          onMouseLeave={scheduleClose}
          style={{ top: position?.top ?? -9999, left: position?.left ?? -9999 }}
          className="fixed z-[60] w-60 rounded-card border border-border bg-surface p-1.5 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.22)] motion-safe:animate-[sidebarFlyIn_120ms_ease-out]"
        >
          {/* Notch pointing at the module icon */}
          <span className="absolute -left-[5px] top-[18px] h-2.5 w-2.5 rotate-45 border-b border-l border-border bg-surface" aria-hidden />
          <div className="flex items-center gap-2 px-2.5 pb-2 pt-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-primary' : 'bg-text-muted/50'}`} aria-hidden />
            <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
          </div>
          <div className="space-y-0.5">
            {items.map((item) => {
              const itemActive = isItemActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setFlyoutOpen(false)}
                  aria-current={itemActive ? 'page' : undefined}
                  className={`group flex h-10 items-center gap-2.5 rounded-card px-2.5 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-text/10 ${itemActive ? 'bg-[#fff7ed] text-primary' : 'text-text hover:bg-bg focus-visible:bg-bg'}`}
                >
                  <MorphIcon icon={item.icon} hoverIcon={item.hoverIcon} className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <MorphIcon icon={ChevronRight} className={`h-3.5 w-3.5 transition-opacity ${itemActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`} />
                </Link>
              )
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

function ChildLink({ item, active }: { item: SidebarModuleItem; active: boolean }) {
  return (
    <Link href={item.href} title={item.label} aria-current={active ? 'page' : undefined} className={`flex h-10 items-center justify-start gap-3 rounded-card px-3 text-xs font-medium transition-colors max-md:h-11 ${active ? 'bg-[#f0f0f0] text-text' : 'text-text-muted hover:bg-bg hover:text-text'}`}>
      <MorphIcon icon={item.icon} hoverIcon={item.hoverIcon} className="h-4 w-4" />
      <span className="truncate">{item.label}</span>
    </Link>
  )
}
