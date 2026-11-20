import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { alignerProduction, idesignOrders, idesignTreatmentCourses } from '@/lib/db/schema'
import {
  applyBatchChange,
  batchCount,
  batchLabel,
  canViewAlignerProduction,
  isValidBatch,
  parseTotalStages,
  RETAINER_BATCH,
  updateAlignerProductionSchema,
} from '@/lib/idesign/production'
import { productionToday } from '@/lib/idesign/productionServer'
import { getAccessibleIDesignCase, recordIDesignActivity, sessionActor } from '@/lib/idesign/workflow'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error
  const role = session!.user.role
  if (!canViewAlignerProduction(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const caseId = Number(params.id)
  if (!Number.isInteger(caseId) || caseId <= 0) return NextResponse.json({ error: 'Invalid order' }, { status: 400 })
  const parsed = updateAlignerProductionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid production update' }, { status: 400 })

  const caseRow = await getAccessibleIDesignCase(caseId, Number(session!.user.id), role)
  if (!caseRow || caseRow.orderType !== 'clear_aligner') return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const db = getDb()
  const [[current], [course], [imported]] = await Promise.all([
    db.select().from(alignerProduction).where(eq(alignerProduction.caseId, caseId)).limit(1),
    db.select({ totalSteps: idesignTreatmentCourses.totalSteps }).from(idesignTreatmentCourses).where(eq(idesignTreatmentCourses.caseId, caseId)).limit(1),
    caseRow.importedOrderId
      ? db.select({ totalSteps: idesignOrders.totalSteps }).from(idesignOrders).where(eq(idesignOrders.id, caseRow.importedOrderId)).limit(1)
      : Promise.resolve([]),
  ])
  const state: { totalStages: number | null; deliveredBatch: number | null; batchDeliveredOn: string | null } = {
    totalStages: current?.totalStages ?? course?.totalSteps ?? parseTotalStages(imported?.totalSteps),
    deliveredBatch: current?.deliveredBatch ?? null,
    batchDeliveredOn: current?.batchDeliveredOn ?? null,
  }
  const data = parsed.data
  let detail: string

  if ('totalStages' in data) {
    const batch = state.deliveredBatch
    if (data.totalStages !== null && batch && batch !== RETAINER_BATCH && batch > batchCount(data.totalStages)) {
      return NextResponse.json({ error: `Stage ${batchLabel(batch, null)} is already delivered; total stages cannot be lower` }, { status: 400 })
    }
    state.totalStages = data.totalStages
    detail = `Total stages set to ${data.totalStages ?? 'empty'}`
  } else if ('deliveredBatch' in data) {
    if (data.deliveredBatch === null) {
      state.deliveredBatch = null
      state.batchDeliveredOn = null
      detail = 'Delivered stages cleared'
    } else {
      if (!isValidBatch(data.deliveredBatch, state.totalStages)) return NextResponse.json({ error: 'Set total stages before choosing this batch' }, { status: 400 })
      Object.assign(state, applyBatchChange(state, data.deliveredBatch, productionToday()))
      detail = `Delivered stages set to ${batchLabel(data.deliveredBatch, state.totalStages)} on ${state.batchDeliveredOn}`
    }
  } else {
    // A date with no batch yet is the 1-10 delivery date (orders delivered before the tracker existed).
    if (data.batchDeliveredOn && !state.deliveredBatch) state.deliveredBatch = 1
    state.batchDeliveredOn = data.batchDeliveredOn
    detail = state.deliveredBatch
      ? `Stages ${batchLabel(state.deliveredBatch, state.totalStages)} delivered date set to ${data.batchDeliveredOn ?? 'empty'}`
      : 'Delivered date cleared'
  }

  const now = new Date()
  const values = { ...state, updatedBy: Number(session!.user.id), updatedAt: now }
  await db.insert(alignerProduction).values({ caseId, ...values })
    .onConflictDoUpdate({ target: alignerProduction.caseId, set: values })
  await recordIDesignActivity({ caseId, eventType: 'production_updated', detail, ...sessionActor(session!) })
  return NextResponse.json({ success: true })
}
