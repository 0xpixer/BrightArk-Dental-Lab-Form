import { auth } from '@/auth'
import { IDesignOrdersTable } from '@/components/admin/IDesignOrdersTable'
import { isAdminRole } from '@/lib/admin/roles'
import { IDESIGN_PROGRESS_OPTIONS } from '@/lib/idesign/orders'
import { redirect } from 'next/navigation'

export default async function ImportedOrdersPage({ searchParams }: { searchParams?: { progress?: string } }) {
  const session = await auth()
  if (!isAdminRole(session?.user.role)) redirect('/admin/overview')

  const progress = IDESIGN_PROGRESS_OPTIONS.includes(searchParams?.progress as (typeof IDESIGN_PROGRESS_OPTIONS)[number])
    ? searchParams!.progress
    : ''

  return <div className="mx-auto max-w-7xl"><IDesignOrdersTable initialProgress={progress} canManage={session.user.role === 'superadmin'} /></div>
}
