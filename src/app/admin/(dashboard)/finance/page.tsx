import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { FinanceTable } from '@/components/finance/FinanceTable'
import { canViewFinance } from '@/lib/finance/finance'

export default async function AdminFinancePage() {
  const session = await auth()
  if (!canViewFinance(session?.user.role ?? '')) redirect('/admin/overview')
  return <div className="mx-auto max-w-[1800px]"><FinanceTable showDoctor /></div>
}
