import { IDesignCasesTable } from '@/components/admin/IDesignCasesTable'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export default async function IDesignOrdersPage() {
  const session = await auth()
  if (!['superadmin', 'sales'].includes(session?.user.role ?? '')) redirect('/admin/overview')
  return <div className="mx-auto max-w-7xl"><IDesignCasesTable /></div>
}
