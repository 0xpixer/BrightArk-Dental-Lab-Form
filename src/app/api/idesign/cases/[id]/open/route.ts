import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/session'
import { canViewIDesign } from '@/lib/idesign/access'
import { getAccessibleIDesignCase } from '@/lib/idesign/workflow'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canViewIDesign(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const caseId = Number(params.id)
  const caseRow = await getAccessibleIDesignCase(caseId, Number(session!.user.id), session!.user.role)
  if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  const url = caseRow.currentEditableUrl
  if (!url) return NextResponse.json({ error: 'Treatment plan link is not available' }, { status: 404 })
  return NextResponse.redirect(url)
}
