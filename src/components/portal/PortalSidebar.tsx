'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { ClipboardList, Plus, UserCircle, LogOut } from 'lucide-react'

export function PortalSidebar({ username, role }: { username: string; role: string }) {
  const pathname = usePathname()
  const links = [
    { href: '/portal/orders', label: 'Dashboard', icon: ClipboardList },
    { href: '/', label: 'New Order', icon: Plus },
    { href: '/portal/profile', label: 'My Profile', icon: UserCircle },
  ]
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface shadow-sm">
      <div className="border-b border-border p-4"><Image src="/Logo-SVG.svg" alt="BrightArk" width={120} height={32} className="h-8 w-auto" /></div>
      <nav className="flex-1 space-y-1 p-3">
        {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex items-center gap-2 rounded-card px-3 py-2 text-sm font-medium transition-colors ${pathname === href ? 'bg-primary/10 text-primary' : 'text-text-muted hover:bg-bg hover:text-text'}`}><Icon className="h-4 w-4" />{label}</Link>)}
      </nav>
      <div className="border-t border-border p-4"><p className="text-sm font-medium text-text">{username}</p><p className="mb-3 text-xs capitalize text-text-muted">{role.replace('_', ' ')}</p><button type="button" onClick={() => signOut({ callbackUrl: '/admin/login' })} className="flex w-full items-center justify-center gap-2 rounded-card border border-border py-2 text-xs font-medium text-text-muted hover:border-primary hover:text-primary"><LogOut className="h-3.5 w-3.5" />Sign Out</button></div>
    </aside>
  )
}
