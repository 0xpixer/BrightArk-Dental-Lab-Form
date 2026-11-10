import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SidebarBannersManager } from '@/components/admin/SidebarBannersManager'

export default async function SidebarBannersPage() {
  const session = await auth()
  if (!session?.user || !['admin', 'superadmin'].includes(session.user.role)) {
    redirect('/admin/overview')
  }

  return <SidebarBannersManager />
}
