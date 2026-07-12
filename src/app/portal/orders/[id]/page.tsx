import { DoctorOrderDetail } from '@/components/portal/DoctorOrderDetail'

export default function PortalOrderPage({ params }: { params: { id: string } }) { return <DoctorOrderDetail orderId={params.id} /> }
