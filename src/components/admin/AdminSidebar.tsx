'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { ClipboardList, LayoutDashboard, Users, UserCircle, LogOut, PanelLeftClose, PanelLeftOpen, Plus, ScanLine } from 'lucide-react'
import { formatAdminRole } from '@/lib/admin/roles'
import { useSidebarCollapse } from '@/hooks/useSidebarCollapse'

interface AdminSidebarProps {
  username: string
  role: string
}

const NAV_GROUPS = [
  { label: null, items: [
    { href: '/admin/overview', label: 'Overview', icon: LayoutDashboard, roles: ['admin', 'superadmin', 'sales'] },
  ] },
  { label: 'Dental Lab Orders', items: [
    { href: '/admin/submissions', label: 'Submissions', icon: ClipboardList, roles: ['admin', 'superadmin', 'sales'] },
    { href: '/', label: 'New Order', icon: Plus, roles: ['admin', 'superadmin', 'sales'] },
  ] },
  { label: 'iDesign', items: [
    { href: '/admin/idesign/orders', label: 'Orders', icon: ScanLine, roles: ['superadmin', 'sales'] },
  ] },
  { label: 'Administration', items: [
    { href: '/admin/accounts', label: 'Accounts', icon: Users, roles: ['superadmin'] },
    { href: '/admin/profile', label: 'My Profile', icon: UserCircle, roles: ['admin', 'superadmin', 'sales'] },
  ] },
]

export function AdminSidebar({ username, role }: AdminSidebarProps) {
  const pathname = usePathname()
  const { collapsed, toggleCollapsed } = useSidebarCollapse()
  const showLabels = !collapsed

  return (
    <aside className={`sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-brand ${collapsed ? 'md:w-16' : 'md:w-60'}`}>
      <div className="flex h-16 items-center justify-between border-b border-border px-3">
        <div className={`flex min-w-0 items-center ${showLabels ? 'md:gap-2' : ''}`}>
          <Image src="/BrightArk icon.PNG" alt="BrightArk" width={32} height={32} className="h-8 w-8 md:hidden" />
          {showLabels && <Image src="/Logo-SVG.svg" alt="BrightArk" width={120} height={32} className="hidden h-8 w-auto md:block" />}
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          className={`hidden h-8 w-8 shrink-0 place-items-center rounded-card text-text-muted transition-colors hover:bg-bg hover:text-text focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-neutral-400 md:grid ${collapsed ? 'mx-auto' : ''}`}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto p-2">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => item.roles.includes(role))
          if (items.length === 0) return null
          return <div key={group.label ?? 'main'} className="space-y-1">
            {group.label && (showLabels
              ? <p className="hidden px-3 pb-1 pt-2 text-[10px] font-semibold uppercase text-text-muted md:block">{group.label}</p>
              : <div className="mx-2 border-t border-border" aria-hidden />)}
            {items.map((item) => {
              const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              const Icon = item.icon
              return <Link key={item.href} href={item.href} title={group.label ? `${group.label}: ${item.label}` : item.label} className={`flex h-10 items-center justify-center gap-3 rounded-card px-2 text-sm font-medium transition-colors duration-brand ${showLabels ? 'md:justify-start md:px-3' : ''} ${active ? 'bg-[#f0f0f0] text-text' : 'text-text-muted hover:bg-bg hover:text-text'}`}>
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {showLabels && <span className="hidden truncate md:inline">{item.label}</span>}
              </Link>
            })}
          </div>
        })}
      </nav>

      <div className="border-t border-border p-2">
        {showLabels && <div className="mb-2 hidden px-2 pt-1 md:block">
          <p className="text-sm font-medium text-text">{username}</p>
          <span className="mt-1 inline-block rounded bg-bg px-2 py-0.5 text-[10px] font-semibold capitalize text-text-muted">
            {formatAdminRole(role)}
          </span>
        </div>}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/admin/login' })}
          className={`flex h-10 w-full items-center justify-center gap-3 rounded-card px-2 text-xs font-medium text-text-muted transition-colors hover:bg-bg hover:text-text ${showLabels ? 'md:justify-start md:px-3' : ''}`}
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
          {showLabels && <span className="hidden md:inline">Sign Out</span>}
        </button>
      </div>
    </aside>
  )
}
