import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers, crmDoctors } from '@/lib/db/schema'
import { canChooseCrmOwner, crmFieldAccess, crmPatchSchema, lockedFieldsInPatch } from '@/lib/crm/crm'
import { linkCrmByEmailQuery } from '@/lib/crm/queries'
import { firstIssue, getCrmDoctor, isUniqueViolation, requireCrmAccess, resolveCrmOwner, serializeCrmRows } from '@/lib/crm/server'

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Name', email: 'Email', clinicName: 'Clinic', address: 'Address', salesId: 'Sales rep',
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { access, error } = await requireCrmAccess()
  if (error) return error
  const id = Number(params.id)
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid record' }, { status: 400 })

  const row = await getCrmDoctor(access, id)
  if (!row) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  const parsed = crmPatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })
  const patch = parsed.data
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const fieldAccess = crmFieldAccess(row)
  const locked = lockedFieldsInPatch(patch, fieldAccess)
  if (locked.length) {
    return NextResponse.json({ error: `${locked.map((field) => FIELD_LABELS[field] ?? field).join(', ')} is managed by the doctor’s account` }, { status: 403 })
  }
  if (patch.salesId !== undefined && patch.salesId !== row.salesId) {
    if (!canChooseCrmOwner(access)) return NextResponse.json({ error: 'Only a Sales Director or Superadmin can reassign doctors' }, { status: 403 })
    const owner = await resolveCrmOwner(access, patch.salesId)
    if ('error' in owner) return NextResponse.json({ error: owner.error }, { status: owner.status })
  }

  const db = getDb()
  try {
    const contractStamp = patch.contractUrl !== undefined
      ? { contractUploadedAt: patch.contractUrl ? new Date() : null, contractFileName: patch.contractUrl ? patch.contractFileName ?? null : null }
      : {}
    await db.update(crmDoctors).set({ ...patch, ...contractStamp, updatedAt: new Date() }).where(eq(crmDoctors.id, id))
  } catch (updateError) {
    if (isUniqueViolation(updateError)) {
      return NextResponse.json({ error: patch.salesId !== undefined ? 'That sales rep already has this doctor in their CRM' : 'This email is already in this sales rep’s CRM' }, { status: 409 })
    }
    throw updateError
  }

  // Two-way sync: safe contact fields also update the doctor's own account.
  const accountUpdate = Object.fromEntries(fieldAccess.writeThrough.filter((field) => field in patch).map((field) => [field, patch[field as keyof typeof patch]]))
  if (row.doctorAccountId && Object.keys(accountUpdate).length) {
    await db.update(adminUsers).set(accountUpdate).where(and(eq(adminUsers.id, row.doctorAccountId), eq(adminUsers.role, 'doctor')))
  }
  if (!row.doctorAccountId && (patch.email !== undefined || patch.salesId !== undefined)) {
    await db.execute(linkCrmByEmailQuery({ crmId: id }))
  }

  const updated = await getCrmDoctor(access, id)
  if (!updated) return NextResponse.json({ row: null })
  const [serialized] = await serializeCrmRows([updated], access)
  return NextResponse.json({ row: serialized })
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const { access, error } = await requireCrmAccess()
  if (error) return error
  const id = Number(params.id)
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid record' }, { status: 400 })
  const row = await getCrmDoctor(access, id)
  if (!row) return NextResponse.json({ error: 'Record not found' }, { status: 404 })
  if (row.doctorAccountId && row.assigned) {
    return NextResponse.json({ error: 'Doctors assigned to this sales rep stay in the CRM. Set the status to Inactive instead.' }, { status: 409 })
  }
  await getDb().delete(crmDoctors).where(eq(crmDoctors.id, id))
  return NextResponse.json({ success: true })
}
