import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { IDesignPlanViewer } from '@/components/idesign/IDesignPlanViewer'
import { getSafeIDesignPlanReturnTo } from '@/lib/idesign/planLinks'

const LIST_HREF = '/portal/idesign/orders'

export default async function PortalIDesignPlanPage({ params, searchParams }: { params: { id: string }; searchParams: { returnTo?: string | string[] } }) {
  const session = await auth()
  if (!['doctor', 'clinic_staff'].includes(session?.user.role ?? '')) redirect('/admin/overview')
  const caseId = Number(params.id)
  if (!Number.isInteger(caseId)) redirect(LIST_HREF)
  return <IDesignPlanViewer caseId={caseId} userId={Number(session!.user.id)} role={session!.user.role} returnTo={getSafeIDesignPlanReturnTo(searchParams.returnTo, LIST_HREF)} />
}
