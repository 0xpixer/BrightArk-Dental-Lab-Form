import { SubmissionsTable } from '@/components/admin/SubmissionsTable'
import { auth } from '@/auth'

export default async function SubmissionsPage() {
  const session = await auth()
  const role = session?.user.role
  return <SubmissionsTable canUpdateStatus={role === 'admin' || role === 'superadmin'} canDelete={role === 'superadmin'} />
}
