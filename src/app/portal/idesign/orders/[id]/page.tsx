import { IDesignCaseDetail } from '@/components/idesign/IDesignCaseDetail'

export default function PortalIDesignCasePage({ params }: { params: { id: string } }) {
  return <IDesignCaseDetail caseId={Number(params.id)} />
}
