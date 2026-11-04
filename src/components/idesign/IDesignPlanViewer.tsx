import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { ExternalLink, X } from 'lucide'
import { MorphIcon } from '@/components/ui/MorphIcon'
import { getDb } from '@/lib/db/client'
import { idesignTreatmentPlans } from '@/lib/db/schema'
import { getIDesignPlanHref } from '@/lib/idesign/planLinks'
import { getAccessibleIDesignCase } from '@/lib/idesign/workflow'

export async function IDesignPlanViewer({
  caseId,
  userId,
  role,
  returnTo,
}: {
  caseId: number
  userId: number
  role: string
  returnTo: string
}) {
  const caseRow = await getAccessibleIDesignCase(caseId, userId, role)
  if (!caseRow) return <PlanUnavailable returnTo={returnTo} message="This treatment plan is not available to your account." />
  if (!caseRow.currentEditableUrl) return <PlanUnavailable returnTo={returnTo} message="No treatment plan link has been published for this order." />

  const [latestPlan] = await getDb()
    .select({ versionNumber: idesignTreatmentPlans.versionNumber })
    .from(idesignTreatmentPlans)
    .where(eq(idesignTreatmentPlans.caseId, caseId))
    .orderBy(desc(idesignTreatmentPlans.versionNumber))
    .limit(1)
  const planHref = getIDesignPlanHref(caseId)
  const title = `Treatment Plan${latestPlan ? ` V${latestPlan.versionNumber}` : ''}`

  return <section className="-m-3 flex h-screen min-h-0 flex-col bg-surface sm:-m-4 md:-m-6">
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-3 sm:px-4">
      <div className="min-w-0"><h1 className="truncate text-sm font-semibold text-text">{title}</h1><p className="truncate text-xs text-text-muted">{caseRow.patientName} · {caseRow.orderNo}</p></div>
      <div className="flex shrink-0 items-center gap-1">
        <a href={planHref} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded px-2 text-xs font-medium text-text-muted hover:bg-bg hover:text-text"><MorphIcon icon={ExternalLink} className="h-3.5 w-3.5" /><span className="hidden sm:inline">Open in new tab</span></a>
        <Link href={returnTo} aria-label="Close treatment plan" title="Close" className="grid h-8 w-8 place-items-center rounded text-text-muted hover:bg-bg hover:text-text"><MorphIcon icon={X} className="h-4 w-4" /></Link>
      </div>
    </header>
    <div className="relative min-h-0 flex-1 bg-bg">
      <p className="absolute inset-0 grid place-items-center text-sm text-text-muted">Loading treatment plan...</p>
      <iframe src={planHref} title={`${title} for ${caseRow.patientName}`} allow="clipboard-read; clipboard-write; fullscreen" allowFullScreen className="relative h-full w-full border-0 bg-white" />
    </div>
  </section>
}

function PlanUnavailable({ returnTo, message }: { returnTo: string; message: string }) {
  return <div className="mx-auto max-w-lg py-16 text-center"><h1 className="text-lg font-semibold text-text">Treatment plan unavailable</h1><p className="mt-2 text-sm text-text-muted">{message}</p><Link href={returnTo} className="mt-5 inline-flex h-9 items-center rounded bg-text px-4 text-sm font-semibold text-white hover:bg-neutral-700">Return to My Orders</Link></div>
}
