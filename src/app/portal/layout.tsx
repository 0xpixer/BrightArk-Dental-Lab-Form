import { auth } from '@/auth'
import { InstallAppPrompt } from '@/components/InstallAppPrompt'
import { redirect } from 'next/navigation'
import { PortalSidebar } from '@/components/portal/PortalSidebar'
import { loadFinanceGate } from '@/lib/finance/accessServer'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/admin/login?callbackUrl=/portal/orders')
  if (!['doctor', 'clinic_staff'].includes(session.user.role)) redirect('/admin/overview')
  // Clinic staff only see Finance when their doctor shares it.
  const financeVisible = session.user.role !== 'clinic_staff' || !(await loadFinanceGate(Number(session.user.id), session.user.role)).gate.hidden
  return <div className="flex min-h-screen flex-col bg-bg md:flex-row"><PortalSidebar username={session.user.username} role={session.user.role} financeVisible={financeVisible} /><div className="flex min-w-0 flex-1 flex-col"><main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">{children}</main></div><InstallAppPrompt /></div>
}
