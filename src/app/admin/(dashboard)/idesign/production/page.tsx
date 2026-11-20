import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AlignerProductionTable } from '@/components/admin/AlignerProductionTable'
import { canViewAlignerProduction } from '@/lib/idesign/production'

export default async function AlignerProductionPage() {
  const session = await auth()
  if (!canViewAlignerProduction(session?.user.role ?? '')) redirect('/admin/overview')
  return <div className="mx-auto max-w-7xl"><AlignerProductionTable /></div>
}
