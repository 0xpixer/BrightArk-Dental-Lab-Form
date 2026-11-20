import { and, asc, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { adminUsers, alignerProduction, idesignCases, idesignOrders, idesignTreatmentCourses } from '@/lib/db/schema'
import { getIDesignCaseAccessCondition } from '@/lib/idesign/access'
import { IDESIGN_PROGRESS_OPTIONS } from '@/lib/idesign/orders'
import { canViewAlignerProduction, nextProductionDue, parseTotalStages } from '@/lib/idesign/production'
import { nextProductionDueSql, productionToday } from '@/lib/idesign/productionServer'

/** Only cases whose treatment plan is approved: Approved and every stage after it (Canceled is left out). */
const PRODUCTION_PROGRESS = IDESIGN_PROGRESS_OPTIONS.slice(IDESIGN_PROGRESS_OPTIONS.indexOf('Approved')).filter((progress) => progress !== 'Canceled')

const doctors = alias(adminUsers, 'production_doctor')
const sales = alias(adminUsers, 'production_sales')

export async function GET(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  const role = session!.user.role
  if (!canViewAlignerProduction(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 50))
  const search = searchParams.get('search')?.trim()
  const dueOnly = searchParams.get('filter') === 'due'
  const today = productionToday()

  // Next production due date in SQL so the list can sort and filter by it.
  const dueDate = nextProductionDueSql
  const conditions = [eq(idesignCases.orderType, 'clear_aligner'), inArray(idesignCases.latestProgress, [...PRODUCTION_PROGRESS])]
  const access = await getIDesignCaseAccessCondition(Number(session!.user.id), role)
  if (access) conditions.push(access)
  if (search) {
    const pattern = `%${search}%`
    conditions.push(or(ilike(idesignCases.orderNo, pattern), ilike(idesignCases.patientName, pattern), ilike(doctors.fullName, pattern), ilike(idesignOrders.doctorName, pattern))!)
  }
  if (dueOnly) conditions.push(sql`${dueDate} <= ${today}::date`)
  const where = and(...conditions)

  const db = getDb()
  const base = () => db.select({
    caseId: idesignCases.id,
    orderNo: idesignCases.orderNo,
    patientName: idesignCases.patientName,
    latestProgress: idesignCases.latestProgress,
    doctorAccountName: doctors.fullName,
    doctorAccountUsername: doctors.username,
    importedDoctorName: idesignOrders.doctorName,
    salesName: sales.fullName,
    salesUsername: sales.username,
    importedTotalSteps: idesignOrders.totalSteps,
    courseTotalSteps: idesignTreatmentCourses.totalSteps,
    totalStages: alignerProduction.totalStages,
    deliveredBatch: alignerProduction.deliveredBatch,
    batchDeliveredOn: alignerProduction.batchDeliveredOn,
    notifiedBatch: alignerProduction.notifiedBatch,
    notifiedAt: alignerProduction.notifiedAt,
    // Finance row: the imported spreadsheet row, or the one created for this order.
    paymentStatus: sql<string | null>`coalesce(${idesignOrders.paymentStatus},
      (select finance.payment_status from idesign_orders finance where finance.case_id = ${idesignCases.id} limit 1))`,
  }).from(idesignCases)
    .leftJoin(alignerProduction, eq(alignerProduction.caseId, idesignCases.id))
    .leftJoin(idesignOrders, eq(idesignOrders.id, idesignCases.importedOrderId))
    .leftJoin(idesignTreatmentCourses, eq(idesignTreatmentCourses.caseId, idesignCases.id))
    .leftJoin(doctors, eq(doctors.id, idesignCases.doctorAccountId))
    .leftJoin(sales, eq(sales.id, idesignCases.salesAccountId))

  const [rows, totalRows] = await Promise.all([
    base().where(where).orderBy(sql`${dueDate} asc nulls last`, desc(idesignCases.createdAt), asc(idesignCases.id)).limit(limit).offset((page - 1) * limit),
    db.select({ count: count() }).from(idesignCases)
      .leftJoin(alignerProduction, eq(alignerProduction.caseId, idesignCases.id))
      .leftJoin(idesignOrders, eq(idesignOrders.id, idesignCases.importedOrderId))
      .leftJoin(idesignTreatmentCourses, eq(idesignTreatmentCourses.caseId, idesignCases.id))
      .leftJoin(doctors, eq(doctors.id, idesignCases.doctorAccountId))
      .where(where),
  ])
  const total = totalRows[0]?.count ?? 0

  return NextResponse.json({
    today,
    rows: rows.map((row) => {
      // Shown until someone saves a total: the wear schedule's or the imported spreadsheet's step count.
      const suggestedTotalStages = row.courseTotalSteps ?? parseTotalStages(row.importedTotalSteps)
      return {
      caseId: row.caseId,
      orderNo: row.orderNo,
      patientName: row.patientName,
      latestProgress: row.latestProgress,
      doctorName: row.doctorAccountName || row.doctorAccountUsername || row.importedDoctorName || null,
      salesName: row.salesName || row.salesUsername || null,
      totalStages: row.totalStages,
      suggestedTotalStages,
      isFree: row.paymentStatus === 'Free',
      deliveredBatch: row.deliveredBatch,
      batchDeliveredOn: row.batchDeliveredOn,
      nextProductionDue: nextProductionDue(row.deliveredBatch, row.batchDeliveredOn, row.totalStages ?? suggestedTotalStages),
      notifiedForCurrentBatch: row.deliveredBatch !== null && row.notifiedBatch === row.deliveredBatch,
    } }),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  })
}
