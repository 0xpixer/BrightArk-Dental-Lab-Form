import { IDesignOrdersTable } from '@/components/admin/IDesignOrdersTable'
import { IDesignCasesTable } from '@/components/admin/IDesignCasesTable'
import { IDESIGN_PROGRESS_OPTIONS } from '@/lib/idesign/orders'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function IDesignOrdersPage({ searchParams }: { searchParams?: { progress?: string } }) {
  const session = await auth()
  if (!['superadmin', 'sales'].includes(session?.user.role ?? '')) redirect('/admin/overview')
  const progress = IDESIGN_PROGRESS_OPTIONS.includes(searchParams?.progress as (typeof IDESIGN_PROGRESS_OPTIONS)[number]) ? searchParams!.progress : ''
  return <div className="mx-auto max-w-7xl space-y-8"><IDesignCasesTable /><IDesignOrdersTable initialProgress={progress} canManage={session?.user.role === 'superadmin'} /></div>
}
