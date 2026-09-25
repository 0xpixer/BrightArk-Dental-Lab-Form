import { auth } from '@/auth'
import OrderForm from '@/components/OrderForm'
import { redirect } from 'next/navigation'

export default async function PortalNewDentalOrderPage() {
  const session = await auth()
  if (!session?.user) redirect('/admin/login?callbackUrl=/portal/orders/new')

  return <OrderForm account={{ username: session.user.username, role: session.user.role }} embedded />
}
