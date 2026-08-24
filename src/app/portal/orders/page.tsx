import { DoctorOrdersTable } from '@/components/portal/DoctorOrdersTable'
import { normalizeOrderStatusFilter } from '@/lib/orderStatus'

export default function PortalOrdersPage({ searchParams }: { searchParams?: { status?: string | string[] } }) {
  return <DoctorOrdersTable initialStatus={normalizeOrderStatusFilter(searchParams?.status)} />
}
