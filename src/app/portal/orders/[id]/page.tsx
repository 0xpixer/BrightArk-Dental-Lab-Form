import { DoctorOrderDetail } from '@/components/portal/DoctorOrderDetail'

export default function PortalOrderPage({ params, searchParams }: { params: { id: string }; searchParams?: { messages?: string } }) {
  return <DoctorOrderDetail orderId={params.id} openMessages={searchParams?.messages === 'open'} />
}
