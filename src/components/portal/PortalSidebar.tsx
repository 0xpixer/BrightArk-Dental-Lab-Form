'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { ClipboardList, LayoutDashboard, Plus, ScanLine, UserCircle, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useSidebarCollapse } from '@/hooks/useSidebarCollapse'

export function PortalSidebar({ username, role }: { username: string; role: string }) {
  const pathname = usePathname()
  const { collapsed, toggleCollapsed } = useSidebarCollapse()
  const showLabels = !collapsed
  const groups = [
    { label: null, links: [{ href: '/portal/overview', label: 'Overview', icon: LayoutDashboard }] },
    { label: 'Dental Lab Orders', links: [{ href: '/portal/orders', label: 'Orders', icon: ClipboardList }, { href: '/', label: 'New Order', icon: Plus }] },
    { label: 'iDesign', links: [{ href: '/portal/idesign/orders', label: 'Orders', icon: ScanLine }] },
    { label: 'Account', links: [{ href: '/portal/profile', label: 'My Profile', icon: UserCircle }] },
  ]
  return (
    <aside className={`sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-brand ${collapsed ? 'md:w-16' : 'md:w-60'}`}>
      <div className="flex h-16 items-center justify-between border-b border-border px-3">
        <div className={`flex min-w-0 items-center ${showLabels ? 'md:gap-2' : ''}`}>
          <Image src="/BrightArk icon.PNG" alt="BrightArk" width={32} height={32} className="h-8 w-8 md:hidden" />
          {showLabels && <Image src="/Logo-SVG.svg" alt="BrightArk" width={120} height={32} className="hidden h-8 w-auto md:block" />}
        </div>
        <button type="button" onClick={toggleCollapsed} className={`hidden h-8 w-8 shrink-0 place-items-center rounded-card text-text-muted transition-colors hover:bg-bg hover:text-text focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400 md:grid ${collapsed ? 'mx-auto' : ''}`} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} title={collapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!collapsed}>
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      <nav className="flex-1 space-y-3 overflow-y-auto p-2">
        {groups.map((group) => <div key={group.label ?? 'main'} className="space-y-1">
          {group.label && (showLabels ? <p className="hidden px-3 pb-1 pt-2 text-[10px] font-semibold uppercase text-text-muted md:block">{group.label}</p> : <div className="mx-2 border-t border-border" />)}
          {group.links.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href)
            return <Link key={href} href={href} title={group.label ? `${group.label}: ${label}` : label} className={`flex h-10 items-center justify-center gap-3 rounded-card px-2 text-sm font-medium transition-colors ${showLabels ? 'md:justify-start md:px-3' : ''} ${active ? 'bg-[#f0f0f0] text-text' : 'text-text-muted hover:bg-bg hover:text-text'}`}><Icon className="h-[18px] w-[18px] shrink-0" />{showLabels && <span className="hidden truncate md:inline">{label}</span>}</Link>
          })}
        </div>)}
      </nav>
      <div className="border-t border-border p-2">{showLabels && <div className="mb-2 hidden px-2 pt-1 md:block"><p className="text-sm font-medium text-text">{username}</p><p className="text-xs capitalize text-text-muted">{role.replace('_', ' ')}</p></div>}<button type="button" onClick={() => signOut({ callbackUrl: '/admin/login' })} title="Sign out" className={`flex h-10 w-full items-center justify-center gap-3 rounded-card px-2 text-xs font-medium text-text-muted hover:bg-bg hover:text-text ${showLabels ? 'md:justify-start md:px-3' : ''}`}><LogOut className="h-4 w-4" />{showLabels && <span className="hidden md:inline">Sign Out</span>}</button></div>
    </aside>
  )
}
