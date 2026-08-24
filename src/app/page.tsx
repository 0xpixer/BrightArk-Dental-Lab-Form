import { auth } from '@/auth'
import OrderForm from '@/components/OrderForm'

export default async function HomePage() {
  const session = await auth()
  const account = session?.user
    ? { username: session.user.username, role: session.user.role }
    : undefined

  return <OrderForm account={account} />
}
