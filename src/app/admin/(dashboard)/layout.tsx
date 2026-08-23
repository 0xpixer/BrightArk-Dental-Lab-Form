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
        <header className="sticky top-0 z-10 border-b border-border bg-surface px-4 py-4 shadow-sm md:px-6">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-text-muted">BrightArk Admin Portal</p>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {session.user.username}
            </span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
