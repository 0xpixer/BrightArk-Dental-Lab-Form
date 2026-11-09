import { IDesignCasesTable } from '@/components/admin/IDesignCasesTable'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { canViewIDesign } from '@/lib/idesign/access'

export default async function IDesignOrdersPage() {
  const session = await auth()
  if (!canViewIDesign(session?.user.role ?? '')) redirect('/admin/overview')
  return <div className="mx-auto max-w-7xl"><IDesignCasesTable /></div>
}
