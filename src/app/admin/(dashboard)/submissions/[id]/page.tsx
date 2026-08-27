import { OrderDetailView } from '@/components/admin/OrderDetailView'
import { auth } from '@/auth'

export default async function SubmissionDetailPage({ params, searchParams }: { params: { id: string }; searchParams?: { messages?: string } }) {
  const session = await auth()
  const role = session?.user.role
  return <OrderDetailView orderId={params.id} canUpdateStatus={role === 'admin' || role === 'superadmin'} canEdit={role === 'superadmin'} openMessages={searchParams?.messages === 'open'} />
}
