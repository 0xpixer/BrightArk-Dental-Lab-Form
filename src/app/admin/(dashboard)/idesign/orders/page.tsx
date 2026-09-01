import { IDesignOrdersTable } from '@/components/admin/IDesignOrdersTable'
import { IDESIGN_PROGRESS_OPTIONS } from '@/lib/idesign/orders'
import { auth } from '@/auth'

export default async function IDesignOrdersPage({ searchParams }: { searchParams?: { progress?: string } }) {
  const session = await auth()
  const progress = IDESIGN_PROGRESS_OPTIONS.includes(searchParams?.progress as (typeof IDESIGN_PROGRESS_OPTIONS)[number]) ? searchParams!.progress : ''
  return <IDesignOrdersTable initialProgress={progress} canManage={session?.user.role === 'superadmin'} />
}
