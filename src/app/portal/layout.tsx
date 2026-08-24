import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { PortalSidebar } from '@/components/portal/PortalSidebar'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/admin/login?callbackUrl=/portal/orders')
  if (!['doctor', 'clinic_staff'].includes(session.user.role)) redirect('/admin/overview')
  return <div className="flex min-h-screen bg-bg"><PortalSidebar username={session.user.username} role={session.user.role} /><div className="flex min-w-0 flex-1 flex-col"><main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">{children}</main></div></div>
}
