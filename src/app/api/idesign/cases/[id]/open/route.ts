import { and, desc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { idesignTreatmentPlans } from '@/lib/db/schema'
import { canViewIDesign } from '@/lib/idesign/access'
import { getAccessibleIDesignCase } from '@/lib/idesign/workflow'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canViewIDesign(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const caseId = Number(params.id)
  const caseRow = await getAccessibleIDesignCase(caseId, Number(session!.user.id), session!.user.role)
  if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  let url: string | null = null
  if (type === 'edit') {
    url = caseRow.currentEditableUrl
  } else {
    const version = Number(searchParams.get('version'))
    const conditions = [eq(idesignTreatmentPlans.caseId, caseId)]
    if (Number.isInteger(version) && version > 0) conditions.push(eq(idesignTreatmentPlans.versionNumber, version))
    const [plan] = await getDb().select({ reviewUrl: idesignTreatmentPlans.reviewUrl }).from(idesignTreatmentPlans).where(conditions.length === 1 ? conditions[0] : and(...conditions)).orderBy(desc(idesignTreatmentPlans.versionNumber)).limit(1)
    url = plan?.reviewUrl ?? null
  }
  if (!url) return NextResponse.json({ error: 'Treatment plan link is not available' }, { status: 404 })
  return NextResponse.redirect(url)
}
