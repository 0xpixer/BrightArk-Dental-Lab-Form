import { EditOrderForm } from '@/components/portal/EditOrderForm'

export default function EditPortalOrderPage({ params }: { params: { id: string } }) { return <EditOrderForm orderId={params.id} /> }
