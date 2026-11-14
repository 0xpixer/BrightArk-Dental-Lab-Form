import { OverviewDashboard } from '@/components/overview/OverviewDashboard'
import { AlignerOverviewDashboard } from '@/components/overview/AlignerOverviewDashboard'
import { PartnerOverview } from '@/components/overview/PartnerOverview'
import { auth } from '@/auth'
import Link from 'next/link'
import { isAdminRole, isDesignerRole, isSalesRole } from '@/lib/admin/roles'

export default async function AdminOverviewPage({ searchParams }: { searchParams?: { view?: string } }) {
  const session = await auth()
  // Sales and Sales Directors get the same action-focused overview as doctors, scoped to their doctors.
  if (isSalesRole(session?.user.role)) {
    return <PartnerOverview
      userName={session?.user.name ?? null}
      paths={{ alignerOrders: '/admin/idesign/orders', labOrders: '/admin/submissions', finance: '/admin/finance', newAligner: '/admin/idesign/orders/new', newLab: null }}
    />
  }
  const designer = isDesignerRole(session?.user.role)
  const canViewAligners = session?.user.role === 'superadmin' || isSalesRole(session?.user.role) || designer
  const view = designer || (canViewAligners && searchParams?.view === 'aligners') ? 'aligners' : 'dental-lab'

  return <div className="space-y-5">
    {canViewAligners && !designer && <nav className="inline-grid grid-cols-2 rounded-card border border-border bg-surface p-1" aria-label="Overview section">
      <Link href="/admin/overview" aria-current={view === 'dental-lab' ? 'page' : undefined} className={`rounded px-4 py-2 text-sm font-semibold transition-colors ${view === 'dental-lab' ? 'bg-text text-white' : 'text-text-muted hover:text-text'}`}>Dental Lab</Link>
      <Link href="/admin/overview?view=aligners" aria-current={view === 'aligners' ? 'page' : undefined} className={`rounded px-4 py-2 text-sm font-semibold transition-colors ${view === 'aligners' ? 'bg-text text-white' : 'text-text-muted hover:text-text'}`}>Aligners</Link>
    </nav>}
    {view === 'aligners' ? <AlignerOverviewDashboard canOpenImportedOrders={isAdminRole(session?.user.role)} /> : <OverviewDashboard ordersPath="/admin/submissions" title={canViewAligners ? 'Dental Lab Overview' : 'Overview'} />}
  </div>
}
