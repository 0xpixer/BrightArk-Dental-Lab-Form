import { auth } from '@/auth'
import { AdminOverview } from '@/components/overview/AdminOverview'
import { PartnerOverview } from '@/components/overview/PartnerOverview'
import { isDesignerRole, isSalesRole } from '@/lib/admin/roles'

export default async function AdminOverviewPage() {
  const session = await auth()
  // Sales and Sales Directors get the same action-focused overview as doctors, scoped to their doctors.
  if (isSalesRole(session?.user.role)) {
    return <PartnerOverview
      userName={session?.user.name ?? null}
      paths={{ alignerOrders: '/admin/idesign/orders', labOrders: '/admin/submissions', finance: '/admin/finance', newAligner: '/admin/idesign/orders/new', newLab: null }}
    />
  }
  return <AdminOverview designer={isDesignerRole(session?.user.role)} />
}
