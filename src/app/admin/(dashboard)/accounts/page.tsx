import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AccountsTable } from '@/components/admin/AccountsTable'

export default async function AccountsPage() {
  const session = await auth()
  if (session?.user.role !== 'superadmin') {
    redirect('/admin/submissions')
  }

  return <AccountsTable currentUserId={parseInt(session.user.id, 10)} />
}
