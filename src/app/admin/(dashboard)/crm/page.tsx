import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { CrmBoard } from '@/components/crm/CrmBoard'
import { canViewCrm } from '@/lib/crm/crm'

export default async function CrmPage() {
  const session = await auth()
  if (!canViewCrm(session?.user.role ?? '')) redirect('/admin/overview')
  return <div className="mx-auto max-w-[1800px]"><CrmBoard /></div>
}
