import { auth } from '@/auth'
import { PartnerOverview } from '@/components/overview/PartnerOverview'

export default async function PortalOverviewPage() {
  const session = await auth()
  return <PartnerOverview
    userName={session?.user.name ?? null}
    paths={{ alignerOrders: '/portal/idesign/orders', labOrders: '/portal/orders', finance: '/portal/finance', newAligner: '/portal/idesign/orders/new', newLab: '/portal/orders/new' }}
  />
}
