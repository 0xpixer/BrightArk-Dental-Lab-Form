'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { ClipboardList, LayoutDashboard, Users, UserCircle, LogOut, Plus } from 'lucide-react'
import { formatAdminRole } from '@/lib/admin/roles'

interface AdminSidebarProps {
  username: string
  role: string
}

const NAV = [
  { href: '/admin/overview', label: 'Overview', icon: LayoutDashboard, roles: ['admin', 'superadmin'] },
  { href: '/admin/submissions', label: 'Submissions', icon: ClipboardList, roles: ['admin', 'superadmin'] },
  { href: '/', label: 'New Order', icon: Plus, roles: ['admin', 'superadmin'] },
  { href: '/admin/accounts', label: 'Accounts', icon: Users, roles: ['superadmin'] },
  { href: '/admin/profile', label: 'My Profile', icon: UserCircle, roles: ['admin', 'superadmin'] },
]

export function AdminSidebar({ username, role }: AdminSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="flex w-16 shrink-0 flex-col border-r border-border bg-surface shadow-sm md:w-60">
      <div className="border-b border-border p-3 md:p-4">
        <div className="flex items-center justify-center gap-2 md:justify-start">
          <Image src="/BrightArk icon.PNG" alt="BrightArk" width={32} height={32} className="h-8 w-8 md:hidden" />
          <Image src="/Logo-SVG.svg" alt="BrightArk" width={120} height={32} className="hidden h-8 w-auto md:block" />
          <span className="hidden rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white md:inline-flex">
            Admin
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.filter((item) => item.roles.includes(role)).map((item) => {
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex items-center justify-center gap-2 rounded-card px-2 py-2 text-sm font-medium transition-colors duration-brand md:justify-start md:px-3 ${
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-muted hover:bg-bg hover:text-text'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden md:inline">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border p-2 md:p-4">
        <div className="mb-3 hidden md:block">
          <p className="text-sm font-medium text-text">{username}</p>
          <span className="mt-1 inline-block rounded bg-secondary/10 px-2 py-0.5 text-[10px] font-semibold capitalize text-secondary">
            {formatAdminRole(role)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/admin/login' })}
          className="flex w-full items-center justify-center gap-2 rounded-card border border-border py-2 text-xs font-medium text-text-muted transition-colors hover:border-primary hover:text-primary"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
