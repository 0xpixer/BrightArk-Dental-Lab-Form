import { EditDraftForm } from '@/components/portal/EditDraftForm'

export default function DraftPage({ params }: { params: { id: string } }) {
  return <EditDraftForm draftId={params.id} />
}
