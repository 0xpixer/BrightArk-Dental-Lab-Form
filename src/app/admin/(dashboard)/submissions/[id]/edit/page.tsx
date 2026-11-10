import { auth } from '@/auth'
import { EditOrderForm } from '@/components/portal/EditOrderForm'
import { redirect } from 'next/navigation'
import { isSalesRole } from '@/lib/admin/roles'

export default async function SalesEditOrderPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!isSalesRole(session?.user.role)) redirect(`/admin/submissions/${params.id}`)
  return <EditOrderForm orderId={params.id} embedded />
}
