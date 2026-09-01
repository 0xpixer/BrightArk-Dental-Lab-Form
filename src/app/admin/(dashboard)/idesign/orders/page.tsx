import { IDesignOrdersTable } from '@/components/admin/IDesignOrdersTable'
import { IDESIGN_PROGRESS_OPTIONS } from '@/lib/idesign/orders'

export default function IDesignOrdersPage({ searchParams }: { searchParams?: { progress?: string } }) {
  const progress = IDESIGN_PROGRESS_OPTIONS.includes(searchParams?.progress as (typeof IDESIGN_PROGRESS_OPTIONS)[number]) ? searchParams!.progress : ''
  return <IDesignOrdersTable initialProgress={progress} />
}
