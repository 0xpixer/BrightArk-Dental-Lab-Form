import { NextResponse } from 'next/server'
import { getCrmDoctor, requireCrmAccess } from '@/lib/crm/server'

/** Scoped contract download: the record must be inside the caller's CRM scope. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { access, error } = await requireCrmAccess()
  if (error) return error
  const id = Number(params.id)
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  const row = await getCrmDoctor(access, id)
  if (!row) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  if (!row.contractUrl) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
  return NextResponse.redirect(row.contractUrl, { status: 302 })
}
