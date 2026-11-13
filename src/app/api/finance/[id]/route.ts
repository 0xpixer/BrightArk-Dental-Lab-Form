import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { idesignOrders } from '@/lib/db/schema'
import { canManageFinance, financeRowSchema, financeRowValues, isAllowedInvoiceUrl } from '@/lib/finance/finance'
import { getActiveDoctor } from '@/lib/finance/server'
import { syncImportedIDesignCases } from '@/lib/idesign/importedCases'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageFinance(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number(params.id)
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  const parsed = financeRowSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid finance record' }, { status: 400 })
  const input = parsed.data

  const db = getDb()
  const [existing] = await db.select({ id: idesignOrders.id, doctorAccountId: idesignOrders.doctorAccountId, invoiceFileUrl: idesignOrders.invoiceFileUrl })
    .from(idesignOrders).where(eq(idesignOrders.id, id)).limit(1)
  if (!existing) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  if (input.invoiceFileUrl !== existing.invoiceFileUrl && !isAllowedInvoiceUrl(input.invoiceFileUrl)) {
    return NextResponse.json({ error: 'Upload the invoice file again' }, { status: 400 })
  }

  const doctorChanged = input.doctorAccountId !== existing.doctorAccountId
  if (doctorChanged && input.doctorAccountId && !(await getActiveDoctor(input.doctorAccountId))) {
    return NextResponse.json({ error: 'Choose an active doctor account' }, { status: 400 })
  }

  const userId = Number(session!.user.id)
  await db.update(idesignOrders).set({
    ...financeRowValues(input),
    // The imported Doctor name is kept as source data so re-imports still match; the account link is what scopes access.
    doctorAccountId: input.doctorAccountId,
    ...(doctorChanged ? { assignmentUpdatedBy: userId, assignmentUpdatedAt: new Date() } : {}),
    updatedAt: new Date(),
  }).where(eq(idesignOrders.id, id))

  await syncImportedIDesignCases([id])
  return NextResponse.json({ success: true })
}
