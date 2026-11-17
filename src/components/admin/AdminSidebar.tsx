'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { BookUser, Boxes, Box, CircleDollarSign, Contact, CirclePlus, Database, DatabaseZap, DoorOpen, ExternalLink, GalleryHorizontal, Globe2, Images, LayoutDashboard, LayoutGrid, List, ListChecks, LogOut, PanelLeftClose, PanelLeftOpen, Plus, ShieldCheck, UserCircle, UserRoundCog, Users, UsersRound, Wallet, type IconNode } from 'lucide'
import { formatAdminRole } from '@/lib/admin/roles'
import { canViewCrm } from '@/lib/crm/crm'
import { useSidebarCollapse } from '@/hooks/useSidebarCollapse'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { ClearAlignerActiveIcon, ClearAlignerIcon, ToothIcon, ToothPolishedIcon } from '@/components/ui/dentalIcons'
import { ClearAlignerGlyph } from '@/components/ui/ClearAlignerGlyph'
import { SidebarBannerCarousel } from '@/components/sidebar/SidebarBannerCarousel'
import { SidebarModule } from '@/components/sidebar/SidebarModule'
import { MobileDrawerBackdrop, MobileDrawerClose, MobileTopBar, sidebarAsideClass, useMobileDrawer } from '@/components/sidebar/MobileNav'

interface AdminSidebarProps { username: string; role: string }

interface NavItem { href: string; label: string; icon: IconNode; hoverIcon: IconNode; roles?: string[]; external?: boolean }
interface NavModule { id: string; label: string; icon: IconNode; hoverIcon: IconNode; roles: string[]; items: NavItem[] }

const MODULES: NavModule[] = [
  { id: 'idesign', label: 'iDesign | Clear Aligners', icon: ClearAlignerIcon, hoverIcon: ClearAlignerActiveIcon, roles: ['superadmin', 'admin', 'sales', 'sales_director', 'treatment_designer'], items: [
    { href: '/admin/idesign/orders', label: 'My Orders', icon: List, hoverIcon: ListChecks },
    { href: '/admin/idesign/orders/new', label: 'New Orders', icon: Plus, hoverIcon: CirclePlus, roles: ['superadmin', 'admin', 'sales', 'sales_director'] },
  ] },
  { id: 'dental', label: 'Dental Lab Orders', icon: ToothIcon, hoverIcon: ToothPolishedIcon, roles: ['admin', 'superadmin', 'sales', 'sales_director'], items: [
    { href: '/admin/submissions', label: 'Submissions', icon: List, hoverIcon: ListChecks },
    { href: '/admin/orders/new', label: 'New Order', icon: Plus, hoverIcon: CirclePlus },
  ] },
  { id: 'admin', label: 'Admin', icon: ShieldCheck, hoverIcon: UserRoundCog, roles: ['admin', 'superadmin'], items: [
    { href: '/admin/imported-orders', label: 'Imported Order Records', icon: Database, hoverIcon: DatabaseZap },
    { href: '/admin/accounts', label: 'Accounts', icon: Users, hoverIcon: UsersRound, roles: ['admin', 'superadmin'] },
    { href: '/admin/sidebar-banners', label: 'Sidebar Banners', icon: GalleryHorizontal, hoverIcon: Images, roles: ['admin', 'superadmin'] },
  ] },
]

export function AdminSidebar({ username, role }: AdminSidebarProps) {
  const pathname = usePathname()
  const { collapsed, toggleCollapsed } = useSidebarCollapse()
  const showLabels = !collapsed
  const drawer = useMobileDrawer(pathname)
  const activeModule = MODULES.find((module) => module.items.some((item) => (!item.roles || item.roles.includes(role)) && isActive(pathname, item.href)))?.id ?? null
  const [openModule, setOpenModule] = useState<string | null>(activeModule)

  useEffect(() => { if (activeModule) setOpenModule(activeModule) }, [activeModule])

  return <>
    <MobileTopBar open={drawer.open} onOpen={() => drawer.setOpen(true)} />
    <MobileDrawerBackdrop open={drawer.open} onClose={() => drawer.setOpen(false)} />
    <aside className={sidebarAsideClass(drawer.open, collapsed)} aria-label="Main navigation">
    <div className="flex h-16 items-center justify-between border-b border-border px-3">
      <div className={`flex min-w-0 items-center ${showLabels ? 'md:gap-2' : ''}`}><Image src="/Logo-SVG.svg" alt="BrightArk" width={150} height={40} className={`h-10 w-auto ${showLabels ? '' : 'md:hidden'}`} /></div><MobileDrawerClose onClose={() => drawer.setOpen(false)} />
      <button type="button" onClick={toggleCollapsed} className={`hidden h-8 w-8 shrink-0 place-items-center rounded-card text-text-muted hover:bg-bg hover:text-text md:grid ${collapsed ? 'mx-auto' : ''}`} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} title={collapsed ? 'Expand navigation' : 'Collapse navigation'} aria-expanded={!collapsed}><MorphIcon icon={collapsed ? PanelLeftOpen : PanelLeftClose} className="h-4 w-4" /></button>
    </div>

    <nav className="flex-1 space-y-2 overflow-y-auto p-2">
      <NavLink href="/admin/overview" label="Overview" icon={LayoutDashboard} hoverIcon={LayoutGrid} active={pathname.startsWith('/admin/overview')} showLabels={showLabels} />
      {MODULES.filter((module) => module.roles.includes(role)).flatMap((module) => {
        const open = openModule === module.id
        const ModuleIcon = module.icon
        const moduleNav = <SidebarModule
          key={module.id}
          id={module.id}
          label={module.label}
          icon={module.id === 'idesign' ? <ClearAlignerGlyph className="h-[18px] w-[18px] shrink-0" /> : <MorphIcon icon={ModuleIcon} hoverIcon={module.hoverIcon} className="h-[18px] w-[18px]" />}
          items={module.items.filter((item) => !item.roles || item.roles.includes(role))}
          open={open}
          onToggle={() => setOpenModule(open ? null : module.id)}
          active={activeModule === module.id}
          collapsed={collapsed}
          isItemActive={(href) => isActive(pathname, href)}
          pathname={pathname}
        />
        // Finance, then the Doctor CRM (Superadmin, Sales Directors and Sales only), sit directly below Dental Lab Orders.
        if (module.id !== 'dental') return [moduleNav]
        return [
          moduleNav,
          <NavLink key="finance" href="/admin/finance" label="Finance" icon={Wallet} hoverIcon={CircleDollarSign} active={pathname.startsWith('/admin/finance')} showLabels={showLabels} />,
          ...(canViewCrm(role) ? [<NavLink key="crm" href="/admin/crm" label="Doctor CRM" icon={Contact} hoverIcon={BookUser} active={pathname.startsWith('/admin/crm')} showLabels={showLabels} />] : []),
        ]
      })}
      <div className="pt-2"><p className={`px-3 pb-1 text-[10px] font-semibold uppercase text-text-muted ${showLabels ? '' : 'md:hidden'}`}>Account</p>{!showLabels && <div className="mx-2 mb-2 hidden border-t border-border md:block" />}
        <NavLink href="/admin/profile" label="My Profile" icon={UserCircle} hoverIcon={UserRoundCog} active={pathname.startsWith('/admin/profile')} showLabels={showLabels} />
      </div>
      <div className={`px-1 pt-2 ${showLabels ? '' : 'md:hidden'}`}><SidebarBannerCarousel /></div>
    </nav>

    <div className="border-t border-border p-2">
      <NavLink href="/admin/dental-anatomy" label="3D Dental Anatomy" icon={Box} hoverIcon={Boxes} active={pathname.startsWith('/admin/dental-anatomy')} showLabels={showLabels} />
      <a href="https://www.thebrightark.com" target="_blank" rel="noreferrer" className={`flex h-10 w-full items-center justify-start gap-3 rounded-card px-3 max-md:h-11 text-xs font-medium text-text-muted hover:bg-bg hover:text-text ${showLabels ? '' : 'md:justify-center md:px-2'}`} title="BrightArk Website"><MorphIcon icon={Globe2} hoverIcon={ExternalLink} className="h-3.5 w-3.5" /><span className={showLabels ? '' : 'md:hidden'}>BrightArk Website</span></a>
      <div className={`mb-2 px-2 pt-1 ${showLabels ? '' : 'md:hidden'}`}><p className="text-sm font-medium text-text">{username}</p><span className="mt-1 inline-block rounded bg-bg px-2 py-0.5 text-[10px] font-semibold capitalize text-text-muted">{formatAdminRole(role)}</span></div>
      <button type="button" onClick={() => signOut({ callbackUrl: '/admin/login' })} className={`flex h-10 w-full items-center justify-start gap-3 rounded-card px-3 max-md:h-11 text-xs font-medium text-text-muted hover:bg-bg hover:text-text ${showLabels ? '' : 'md:justify-center md:px-2'}`} title="Sign out"><MorphIcon icon={LogOut} hoverIcon={DoorOpen} className="h-3.5 w-3.5" /><span className={showLabels ? '' : 'md:hidden'}>Sign Out</span></button>
    </div>
  </aside>
  </>
}

function isActive(pathname: string, href: string) {
  if (href.endsWith('/idesign/orders')) return pathname === href
  return pathname.startsWith(href)
}

function NavLink({ href, label, icon, hoverIcon, active, showLabels, child = false, external = false }: { href: string; label: string; icon: IconNode; hoverIcon: IconNode; active: boolean; showLabels: boolean; child?: boolean; external?: boolean }) {
  return <Link href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} title={label} className={`flex h-10 items-center justify-start gap-3 rounded-card px-3 max-md:h-11 text-sm font-medium transition-colors ${showLabels ? '' : 'md:justify-center md:px-2'} ${child ? 'text-xs' : ''} ${active ? child ? 'bg-[#f0f0f0] text-text' : 'bg-primary text-white' : 'text-text-muted hover:bg-bg hover:text-text'}`}><MorphIcon icon={icon} hoverIcon={hoverIcon} className={child ? 'h-4 w-4' : 'h-[18px] w-[18px]'} /><span className={`truncate ${showLabels ? '' : 'md:hidden'}`}>{label}</span></Link>
}
