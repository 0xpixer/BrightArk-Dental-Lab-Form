import { auth } from '@/auth'
import OrderForm from '@/components/OrderForm'
import { getIDesignOverviewPath, getLoginPath, isIDesignHostname } from '@/lib/siteRouting'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const session = await auth()
  const requestHeaders = headers()
  const hostname = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')

  if (isIDesignHostname(hostname)) {
    const overviewPath = getIDesignOverviewPath(session?.user.role)
    redirect(session?.user ? overviewPath : getLoginPath(overviewPath))
  }

  const account = session?.user
    ? { username: session.user.username, role: session.user.role }
    : undefined

  return <OrderForm account={account} />
}
