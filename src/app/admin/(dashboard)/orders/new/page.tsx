import { auth } from '@/auth'
import OrderForm from '@/components/OrderForm'
import { redirect } from 'next/navigation'

export default async function AdminNewDentalOrderPage() {
  const session = await auth()
  if (!session?.user) redirect('/admin/login?callbackUrl=/admin/orders/new')

  return <OrderForm account={{ username: session.user.username, role: session.user.role }} embedded />
}
