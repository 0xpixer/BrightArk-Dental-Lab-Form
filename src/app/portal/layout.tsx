import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { PortalSidebar } from '@/components/portal/PortalSidebar'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/admin/login?callbackUrl=/portal/orders')
  if (!['doctor', 'clinic_staff'].includes(session.user.role)) redirect('/admin/overview')
  return <div className="flex min-h-screen bg-bg"><PortalSidebar username={session.user.username} role={session.user.role} /><div className="flex min-w-0 flex-1 flex-col"><header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-surface px-4 md:px-6"><p className="text-sm font-medium text-text-muted">BrightArk Doctor Portal</p></header><main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">{children}</main></div></div>
}
