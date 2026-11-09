import { auth } from '@/auth'
import OrderForm from '@/components/OrderForm'
import { redirect } from 'next/navigation'
import { isDesignerRole } from '@/lib/admin/roles'

export default async function AdminNewDentalOrderPage() {
  const session = await auth()
  if (!session?.user) redirect('/admin/login?callbackUrl=/admin/orders/new')
  if (isDesignerRole(session.user.role)) redirect('/admin/idesign/orders')

  return <OrderForm account={{ username: session.user.username, role: session.user.role }} embedded />
}
