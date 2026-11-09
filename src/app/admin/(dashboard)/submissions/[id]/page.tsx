import { OrderDetailView } from '@/components/admin/OrderDetailView'
import { auth } from '@/auth'
import { isDesignerRole } from '@/lib/admin/roles'
import { redirect } from 'next/navigation'

export default async function SubmissionDetailPage({ params, searchParams }: { params: { id: string }; searchParams?: { messages?: string } }) {
  const session = await auth()
  const role = session?.user.role
  if (isDesignerRole(role)) redirect('/admin/idesign/orders')
  return <OrderDetailView orderId={params.id} canUpdateStatus={role === 'admin' || role === 'superadmin'} canEdit={role === 'superadmin'} canEditPendingOrder={role === 'sales'} canUploadProductionFiles={role === 'admin' || role === 'superadmin'} openMessages={searchParams?.messages === 'open'} />
}
