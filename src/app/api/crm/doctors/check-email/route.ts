import { NextResponse } from 'next/server'
import { normalizeCrmEmail } from '@/lib/crm/crm'
import { checkCrmEmail, requireCrmAccess } from '@/lib/crm/server'

export async function GET(request: Request) {
  const { access, error } = await requireCrmAccess()
  if (error) return error
  const { searchParams } = new URL(request.url)
  const email = normalizeCrmEmail(searchParams.get('email'))
  if (!email || email.length > 254) return NextResponse.json({ inScope: [], otherCount: 0, registered: null })
  const salesId = Number(searchParams.get('salesId')) || (access.all ? null : access.userId)
  const excludeId = Number(searchParams.get('excludeId')) || null
  return NextResponse.json(await checkCrmEmail(access, email, salesId, excludeId))
}
