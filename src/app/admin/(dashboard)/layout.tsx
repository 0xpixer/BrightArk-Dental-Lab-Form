import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) {
    redirect('/admin/login')
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <AdminSidebar username={session.user.username} role={session.user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center border-b border-border bg-surface px-4 md:px-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-text-muted">BrightArk Admin Portal</p>
            <span className="rounded-full bg-bg px-3 py-1 text-xs font-medium text-text-muted">
              {session.user.username}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
