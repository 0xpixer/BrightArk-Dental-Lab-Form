import { SubmissionsTable } from '@/components/admin/SubmissionsTable'
import { auth } from '@/auth'
import { normalizeOrderStatusFilter } from '@/lib/orderStatus'

export default async function SubmissionsPage({ searchParams }: { searchParams?: { status?: string | string[] } }) {
  const session = await auth()
  const role = session?.user.role
  return <SubmissionsTable canUpdateStatus={role === 'admin' || role === 'superadmin'} canDelete={role === 'superadmin'} initialStatus={normalizeOrderStatusFilter(searchParams?.status)} />
}
