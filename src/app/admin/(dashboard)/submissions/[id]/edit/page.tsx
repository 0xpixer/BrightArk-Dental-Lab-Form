import { auth } from '@/auth'
import { EditOrderForm } from '@/components/portal/EditOrderForm'
import { redirect } from 'next/navigation'

export default async function SalesEditOrderPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (session?.user.role !== 'sales') redirect(`/admin/submissions/${params.id}`)
  return <EditOrderForm orderId={params.id} embedded />
}
