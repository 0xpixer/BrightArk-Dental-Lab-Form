import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireSession } from '@/lib/admin/session'
import { canViewIDesign } from '@/lib/idesign/access'
import { getAccessibleIDesignCase } from '@/lib/idesign/workflow'
import { getDb } from '@/lib/db/client'
import { idesignTreatmentPlans } from '@/lib/db/schema'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canViewIDesign(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const caseId = Number(params.id)
  const caseRow = await getAccessibleIDesignCase(caseId, Number(session!.user.id), session!.user.role)
  if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  const planId = Number(new URL(request.url).searchParams.get('planId'))
  const [plan] = Number.isInteger(planId) && planId > 0
    ? await getDb().select({ editableUrl: idesignTreatmentPlans.editableUrl }).from(idesignTreatmentPlans).where(and(eq(idesignTreatmentPlans.id, planId), eq(idesignTreatmentPlans.caseId, caseId))).limit(1)
    : []
  const url = plan?.editableUrl || caseRow.currentEditableUrl
  if (!url) return NextResponse.json({ error: 'Treatment plan link is not available' }, { status: 404 })
  return NextResponse.redirect(url)
}
