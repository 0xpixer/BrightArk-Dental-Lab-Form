import { OrderDetailView } from '@/components/admin/OrderDetailView'

export default function SubmissionDetailPage({ params }: { params: { id: string } }) {
  return <OrderDetailView orderId={params.id} />
}
