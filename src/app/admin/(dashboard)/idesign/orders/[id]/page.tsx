import { auth } from '@/auth'
import { IDesignCaseDetail } from '@/components/idesign/IDesignCaseDetail'
import { redirect } from 'next/navigation'

export default async function AdminIDesignCasePage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!['superadmin', 'admin', 'sales'].includes(session?.user.role ?? '')) redirect('/admin/overview')
  const caseId = Number(params.id)
  if (!Number.isInteger(caseId)) redirect('/admin/idesign/orders')
  return <IDesignCaseDetail caseId={caseId} />
}
