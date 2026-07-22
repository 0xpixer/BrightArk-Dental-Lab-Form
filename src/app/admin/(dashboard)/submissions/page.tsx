import { SubmissionsTable } from '@/components/admin/SubmissionsTable'
import { auth } from '@/auth'

export default async function SubmissionsPage() {
  const session = await auth()
  return <SubmissionsTable canModify={session?.user.role === 'superadmin'} />
}
