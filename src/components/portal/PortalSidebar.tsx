'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { ClipboardList, LayoutDashboard, Plus, UserCircle, LogOut } from 'lucide-react'

export function PortalSidebar({ username, role }: { username: string; role: string }) {
  const pathname = usePathname()
  const links = [
    { href: '/portal/overview', label: 'Overview', icon: LayoutDashboard },
    { href: '/portal/orders', label: 'Orders', icon: ClipboardList },
    { href: '/', label: 'New Order', icon: Plus },
    { href: '/portal/profile', label: 'My Profile', icon: UserCircle },
  ]
  return (
    <aside className="flex w-16 shrink-0 flex-col border-r border-border bg-surface shadow-sm md:w-60">
      <div className="border-b border-border p-3 md:p-4"><Image src="/BrightArk icon.PNG" alt="BrightArk" width={32} height={32} className="mx-auto h-8 w-8 md:hidden" /><Image src="/Logo-SVG.svg" alt="BrightArk" width={120} height={32} className="hidden h-8 w-auto md:block" /></div>
      <nav className="flex-1 space-y-1 p-3">
        {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} title={label} className={`flex items-center justify-center gap-2 rounded-card px-2 py-2 text-sm font-medium transition-colors md:justify-start md:px-3 ${pathname === href ? 'bg-primary/10 text-primary' : 'text-text-muted hover:bg-bg hover:text-text'}`}><Icon className="h-4 w-4" /><span className="hidden md:inline">{label}</span></Link>)}
      </nav>
      <div className="border-t border-border p-2 md:p-4"><div className="hidden md:block"><p className="text-sm font-medium text-text">{username}</p><p className="mb-3 text-xs capitalize text-text-muted">{role.replace('_', ' ')}</p></div><button type="button" onClick={() => signOut({ callbackUrl: '/admin/login' })} title="Sign out" className="flex w-full items-center justify-center gap-2 rounded-card border border-border py-2 text-xs font-medium text-text-muted hover:border-primary hover:text-primary"><LogOut className="h-3.5 w-3.5" /><span className="hidden md:inline">Sign Out</span></button></div>
    </aside>
  )
}
