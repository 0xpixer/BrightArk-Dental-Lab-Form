import { asc, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers, idesignOrders, salesDoctorAssignments, type NewIDesignOrder } from '@/lib/db/schema'

interface Account { id: number; fullName: string | null; username: string; country?: string | null }

export interface FinanceSourceCase {
  id: number
  orderNo: string
  patientName: string
  doctorAccountId: number | null
  salesAccountId: number | null
  createdBy: number | null
  createdAt: Date
}

export interface FinanceSourceDentalOrder {
  id: number
  orderNo: string
  patientName: string
  treatmentType: string | null
  submittedBy: number | null
  createdAt: Date
}

function accountName(account: Account | null | undefined) {
  return account ? account.fullName || account.username : null
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

/** The Finance row pre-filled for a new clear aligner case. Prices stay empty for admin. */
export function buildCaseFinanceRow(caseRow: FinanceSourceCase, doctor: Account | null, sales: Account | null): NewIDesignOrder {
  const created = isoDate(caseRow.createdAt)
  return {
    caseId: caseRow.id,
    orderNo: caseRow.orderNo,
    patientName: caseRow.patientName,
    category: 'iAlign',
    doctorAccountId: doctor?.id ?? null,
    doctorName: accountName(doctor) ?? '-',
    salesAccountId: sales?.id ?? null,
    salespersonName: accountName(sales) ?? '-',
    country: doctor?.country || '-',
    latestProgress: 'Entering Info',
    paymentStatus: 'Invoice not issue',
    sourceCreatedOn: created,
    sourceUpdatedOn: created,
    createdBy: caseRow.createdBy,
  }
}

/** The Finance row pre-filled for a new Dental Lab order. */
export function buildDentalOrderFinanceRow(order: FinanceSourceDentalOrder, doctor: Account | null, sales: Account | null, createdBy: number | null): NewIDesignOrder {
  const created = isoDate(order.createdAt)
  return {
    dentalOrderId: order.id,
    orderNo: order.orderNo,
    patientName: order.patientName,
    category: 'Dental Lab',
    purchasedProducts: order.treatmentType,
    doctorAccountId: doctor?.id ?? null,
    doctorName: accountName(doctor) ?? '-',
    salesAccountId: sales?.id ?? null,
    salespersonName: accountName(sales) ?? '-',
    country: doctor?.country || '-',
    latestProgress: 'Entering Info',
    paymentStatus: 'Invoice not issue',
    sourceCreatedOn: created,
    sourceUpdatedOn: created,
    createdBy,
  }
}

async function loadAccounts(ids: Array<number | null | undefined>) {
  const wanted = [...new Set(ids.filter((id): id is number => typeof id === 'number' && id > 0))]
  if (wanted.length === 0) return new Map<number, Account>()
  const rows = await getDb()
    .select({ id: adminUsers.id, fullName: adminUsers.fullName, username: adminUsers.username, country: adminUsers.country })
    .from(adminUsers)
    .where(inArray(adminUsers.id, wanted))
  return new Map(rows.map((row) => [row.id, row]))
}

/** First Sales account assigned to the doctor, used when the order itself names no Sales account. */
async function firstAssignedSalesId(doctorId: number | null) {
  if (!doctorId) return null
  const [row] = await getDb()
    .select({ salesId: salesDoctorAssignments.salesId })
    .from(salesDoctorAssignments)
    .where(eq(salesDoctorAssignments.doctorId, doctorId))
    .orderBy(asc(salesDoctorAssignments.createdAt))
    .limit(1)
  return row?.salesId ?? null
}

/** Idempotent: the unique case_id index keeps one Finance row per case. */
export async function createFinanceRowForCase(caseRow: FinanceSourceCase) {
  const salesId = caseRow.salesAccountId ?? await firstAssignedSalesId(caseRow.doctorAccountId)
  const accounts = await loadAccounts([caseRow.doctorAccountId, salesId])
  const doctor = caseRow.doctorAccountId ? accounts.get(caseRow.doctorAccountId) ?? null : null
  const sales = salesId ? accounts.get(salesId) ?? null : null
  await getDb().insert(idesignOrders)
    .values(buildCaseFinanceRow(caseRow, doctor, sales))
    .onConflictDoNothing({ target: idesignOrders.caseId })
}

/** Idempotent: the unique dental_order_id index keeps one Finance row per Dental Lab order. */
export async function createFinanceRowForDentalOrder(order: FinanceSourceDentalOrder, options: { submittingSalesId?: number | null; createdBy?: number | null } = {}) {
  const salesId = options.submittingSalesId ?? await firstAssignedSalesId(order.submittedBy)
  const accounts = await loadAccounts([order.submittedBy, salesId])
  const doctor = order.submittedBy ? accounts.get(order.submittedBy) ?? null : null
  const sales = salesId ? accounts.get(salesId) ?? null : null
  await getDb().insert(idesignOrders)
    .values(buildDentalOrderFinanceRow(order, doctor, sales, options.createdBy ?? null))
    .onConflictDoNothing({ target: idesignOrders.dentalOrderId })
}

/** Keeps a case's Finance row assigned to the same doctor and sales account as the case. */
export async function syncCaseFinanceAssignment(caseId: number, assignment: { doctorAccountId: number | null; salesAccountId: number | null }, updatedBy: number) {
  const accounts = await loadAccounts([assignment.doctorAccountId, assignment.salesAccountId])
  const doctor = assignment.doctorAccountId ? accounts.get(assignment.doctorAccountId) : null
  const sales = assignment.salesAccountId ? accounts.get(assignment.salesAccountId) : null
  await getDb().update(idesignOrders).set({
    doctorAccountId: assignment.doctorAccountId,
    salesAccountId: assignment.salesAccountId,
    ...(doctor ? { doctorName: accountName(doctor)!, country: doctor.country || '-' } : {}),
    ...(sales ? { salespersonName: accountName(sales)! } : {}),
    assignmentUpdatedBy: updatedBy,
    assignmentUpdatedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(idesignOrders.caseId, caseId))
}
