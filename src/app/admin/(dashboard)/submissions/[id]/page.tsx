import { OrderDetailView } from '@/components/admin/OrderDetailView'
import { auth } from '@/auth'

export default async function SubmissionDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  return <OrderDetailView orderId={params.id} canModify={session?.user.role === 'superadmin'} />
}
