import Link from 'next/link'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AccountsTable } from '@/components/admin/AccountsTable'
import { RelationshipsBoard } from '@/components/admin/RelationshipsBoard'

const TABS = [
  { key: 'accounts', label: 'Accounts', href: '/admin/accounts' },
  { key: 'relationships', label: 'Relationships', href: '/admin/accounts?tab=relationships' },
] as const

export default async function AccountsPage({ searchParams }: { searchParams: { tab?: string } }) {
  const session = await auth()
  if (!session?.user || !['admin', 'superadmin'].includes(session.user.role)) {
    redirect('/admin/submissions')
  }
  const tab = searchParams.tab === 'relationships' ? 'relationships' : 'accounts'

  return <>
    <nav aria-label="Accounts sections" className="mb-4 flex gap-1 border-b border-border">
      {TABS.map((item) => <Link
        key={item.key}
        href={item.href}
        aria-current={tab === item.key ? 'page' : undefined}
        className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === item.key ? 'border-text text-text' : 'border-transparent text-text-muted hover:text-text'}`}
      >{item.label}</Link>)}
    </nav>
    {tab === 'relationships'
      ? <RelationshipsBoard />
      : <AccountsTable currentUserId={parseInt(session.user.id, 10)} currentUserRole={session.user.role} />}
  </>
}
