import { OverviewDashboard } from '@/components/overview/OverviewDashboard'
import { AlignerOverviewDashboard } from '@/components/overview/AlignerOverviewDashboard'
import { auth } from '@/auth'
import Link from 'next/link'

export default async function AdminOverviewPage({ searchParams }: { searchParams?: { view?: string } }) {
  const session = await auth()
  const canViewAligners = session?.user.role === 'superadmin'
  const view = canViewAligners && searchParams?.view === 'aligners' ? 'aligners' : 'dental-lab'

  return <div className="space-y-5">
    {canViewAligners && <nav className="inline-grid grid-cols-2 rounded-card border border-border bg-surface p-1" aria-label="Overview section">
      <Link href="/admin/overview" aria-current={view === 'dental-lab' ? 'page' : undefined} className={`rounded px-4 py-2 text-sm font-semibold transition-colors ${view === 'dental-lab' ? 'bg-text text-white' : 'text-text-muted hover:text-text'}`}>Dental Lab</Link>
      <Link href="/admin/overview?view=aligners" aria-current={view === 'aligners' ? 'page' : undefined} className={`rounded px-4 py-2 text-sm font-semibold transition-colors ${view === 'aligners' ? 'bg-text text-white' : 'text-text-muted hover:text-text'}`}>Aligners</Link>
    </nav>}
    {view === 'aligners' ? <AlignerOverviewDashboard /> : <OverviewDashboard ordersPath="/admin/submissions" title={canViewAligners ? 'Dental Lab Overview' : 'Overview'} />}
  </div>
}
