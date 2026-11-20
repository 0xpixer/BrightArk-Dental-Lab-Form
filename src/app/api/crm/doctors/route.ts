import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { crmDoctors } from '@/lib/db/schema'
import { canChooseCrmOwner, CRM_FOLLOW_UP_FILTERS, CRM_STATUSES, crmCreateSchema } from '@/lib/crm/crm'
import { linkCrmByEmailQuery } from '@/lib/crm/queries'
import {
  firstIssue, getCrmCountries, getCrmDoctor, getCrmOwnerOptions, isUniqueViolation, listCrmDoctors,
  requireCrmAccess, resolveCrmOwner, serializeCrmRows, syncCrm,
} from '@/lib/crm/server'

export async function GET(request: Request) {
  const { access, error } = await requireCrmAccess()
  if (error) return error

  // Self-healing back-fill: assigned doctors and email links appear even if a hook was missed.
  try {
    await syncCrm(access.all ? undefined : access.salesIds)
  } catch (syncError) {
    console.error('CRM sync on load failed', syncError instanceof Error ? syncError.message : syncError)
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')?.trim() ?? ''
  const followUp = searchParams.get('followUp')?.trim() ?? ''
  const salesId = Number(searchParams.get('salesId'))
  const today = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('today') ?? '') ? searchParams.get('today')! : new Date().toISOString().slice(0, 10)

  const chooseOwner = canChooseCrmOwner(access)
  const [{ rows, truncated }, countries, owners] = await Promise.all([
    listCrmDoctors(access, {
      search: searchParams.get('search')?.trim().slice(0, 200) || undefined,
      status: (CRM_STATUSES as readonly string[]).includes(status) ? status : undefined,
      country: searchParams.get('country')?.trim() || undefined,
      salesId: chooseOwner && Number.isSafeInteger(salesId) && salesId > 0 ? salesId : undefined,
      followUp: (CRM_FOLLOW_UP_FILTERS as readonly string[]).includes(followUp) ? followUp : undefined,
      today,
    }),
    getCrmCountries(access),
    getCrmOwnerOptions(access),
  ])

  return NextResponse.json({
    rows: await serializeCrmRows(rows, access),
    truncated,
    viewer: { userId: access.userId, role: access.role, canChooseOwner: chooseOwner },
    options: { statuses: CRM_STATUSES, countries, owners },
  })
}

export async function POST(request: Request) {
  const { access, error } = await requireCrmAccess()
  if (error) return error

  const parsed = crmCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })
  const owner = await resolveCrmOwner(access, parsed.data.salesId)
  if ('error' in owner) return NextResponse.json({ error: owner.error }, { status: owner.status })

  const { salesId: _ignored, ...values } = parsed.data
  const db = getDb()
  let created: { id: number } | undefined
  try {
    [created] = await db.insert(crmDoctors).values({
      ...values,
      contractFileName: values.contractUrl ? values.contractFileName : null,
      contractUploadedAt: values.contractUrl ? new Date() : null,
      salesId: owner.salesId,
      source: 'sales',
      createdBy: access.userId,
    }).returning({ id: crmDoctors.id })
  } catch (insertError) {
    if (isUniqueViolation(insertError)) return NextResponse.json({ error: 'This email is already in this sales rep’s CRM' }, { status: 409 })
    throw insertError
  }
  // If the doctor already has an account with this email, link it now.
  await db.execute(linkCrmByEmailQuery({ crmId: created!.id }))
  const row = await getCrmDoctor(access, created!.id)
  const [serialized] = row ? await serializeCrmRows([row], access) : []
  return NextResponse.json({ row: serialized ?? null }, { status: 201 })
}
