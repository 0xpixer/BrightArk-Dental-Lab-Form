import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { NewAccountForm } from '@/components/admin/NewAccountForm'

export default async function NewAccountPage() {
  const session = await auth()
  if (session?.user.role !== 'superadmin') {
    redirect('/admin/submissions')
  }

  return <NewAccountForm />
}
