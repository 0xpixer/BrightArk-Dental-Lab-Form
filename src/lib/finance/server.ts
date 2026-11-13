import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers, appSettings, idesignCases, idesignOrders, salesDoctorAssignments } from '@/lib/db/schema'
import { isPortalRole, isSalesRole } from '@/lib/admin/roles'
import { getOrderOwnerId } from '@/lib/portal/access'
import { getSalesScopeIds } from '@/lib/sales/access'
import {
  buildFinanceScope,
  displayFinanceTotal,
  FINANCE_OVERDUE_DAYS_KEY,
  isFinanceOverdue,
  parseOverdueDays,
  resolveFinanceDueDate,
} from './finance'

export async function getFinanceScope(userId: number, role: string) {
  if (isPortalRole(role)) return buildFinanceScope({ role, ownerId: await getOrderOwnerId(userId, role) })
  if (isSalesRole(role)) {
    const salesIds = await getSalesScopeIds(userId)
    // Every doctor ever assigned to these sales accounts, including inactive ones, so history stays visible.
    const doctors = await getDb()
      .selectDistinct({ doctorId: salesDoctorAssignments.doctorId })
      .from(salesDoctorAssignments)
      .where(inArray(salesDoctorAssignments.salesId, salesIds))
    return buildFinanceScope({ role, salesIds, doctorIds: doctors.map((row) => row.doctorId) })
  }
  return buildFinanceScope({ role })
}

export async function getFinanceOverdueDays() {
  const [row] = await getDb().select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, FINANCE_OVERDUE_DAYS_KEY)).limit(1)
  return parseOverdueDays(row?.value)
}

export async function setFinanceOverdueDays(days: number, userId: number) {
  await getDb().insert(appSettings)
    .values({ key: FINANCE_OVERDUE_DAYS_KEY, value: String(days), updatedBy: userId, updatedAt: new Date() })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: String(days), updatedBy: userId, updatedAt: new Date() } })
}

/** SQL for "Unpaid and past its due date", matching isFinanceOverdue. */
export function financeOverdueCondition(overdueDays: number, today: string) {
  return and(
    eq(idesignOrders.paymentStatus, 'Unpaid'),
    sql`coalesce(${idesignOrders.dueDate}, ${idesignOrders.invoiceDate} + ${overdueDays}::int) < ${today}::date`,
  )!
}

export const financeSelection = {
  id: idesignOrders.id,
  patientName: idesignOrders.patientName,
  orderNo: sql<string | null>`coalesce(${idesignOrders.orderNo}, ${idesignCases.orderNo})`,
  category: idesignOrders.category,
  purchasedProducts: idesignOrders.purchasedProducts,
  originalCurrency: idesignOrders.originalCurrency,
  originalPrice: idesignOrders.originalPrice,
  discount: idesignOrders.discount,
  totalAmount: idesignOrders.totalAmount,
  paymentStatus: idesignOrders.paymentStatus,
  invoiceNo: idesignOrders.invoiceNo,
  invoiceDate: idesignOrders.invoiceDate,
  dueDate: idesignOrders.dueDate,
  paymentDate: idesignOrders.paymentDate,
  invoiceFileUrl: idesignOrders.invoiceFileUrl,
  invoiceFileName: idesignOrders.invoiceFileName,
  paymentLink: idesignOrders.paymentLink,
  doctorAccountId: idesignOrders.doctorAccountId,
  sourceDoctorName: idesignOrders.doctorName,
  doctorFullName: adminUsers.fullName,
  doctorUsername: adminUsers.username,
  sourceCreatedOn: idesignOrders.sourceCreatedOn,
}

export function financeBaseQuery() {
  return getDb()
    .select(financeSelection)
    .from(idesignOrders)
    .leftJoin(idesignCases, eq(idesignCases.importedOrderId, idesignOrders.id))
    .leftJoin(adminUsers, eq(adminUsers.id, idesignOrders.doctorAccountId))
}

type FinanceSelectRow = Awaited<ReturnType<typeof financeBaseQuery>>[number]

export function serializeFinanceRow(row: FinanceSelectRow, overdueDays: number, canManage: boolean, today: string) {
  return {
    id: row.id,
    patientName: row.patientName,
    orderNo: row.orderNo,
    category: row.category,
    purchasedProducts: row.purchasedProducts,
    currency: row.originalCurrency,
    originalPrice: row.originalPrice,
    discount: row.discount,
    totalAmount: displayFinanceTotal(row),
    paymentStatus: row.paymentStatus,
    invoiceNo: row.invoiceNo,
    invoiceDate: row.invoiceDate,
    dueDate: row.dueDate,
    effectiveDueDate: resolveFinanceDueDate(row, overdueDays),
    paymentDate: row.paymentDate,
    overdue: isFinanceOverdue(row, overdueDays, today),
    hasInvoice: Boolean(row.invoiceFileUrl),
    invoiceFileName: row.invoiceFileName,
    // Admins edit the stored URL; everyone else downloads through the scoped invoice route.
    invoiceFileUrl: canManage ? row.invoiceFileUrl : null,
    paymentLink: row.paymentLink,
    doctorAccountId: row.doctorAccountId,
    doctorName: row.doctorFullName || row.doctorUsername || row.sourceDoctorName,
  }
}

export type FinanceRowDto = ReturnType<typeof serializeFinanceRow>

export async function getActiveDoctors() {
  return getDb()
    .select({ id: adminUsers.id, fullName: adminUsers.fullName, username: adminUsers.username, clinicName: adminUsers.clinicName, country: adminUsers.country })
    .from(adminUsers)
    .where(and(eq(adminUsers.role, 'doctor'), eq(adminUsers.isActive, true)))
    .orderBy(asc(adminUsers.fullName), asc(adminUsers.username))
}

export async function getActiveDoctor(id: number) {
  const [doctor] = await getDb()
    .select({ id: adminUsers.id, fullName: adminUsers.fullName, username: adminUsers.username, country: adminUsers.country })
    .from(adminUsers)
    .where(and(eq(adminUsers.id, id), eq(adminUsers.role, 'doctor'), eq(adminUsers.isActive, true)))
    .limit(1)
  return doctor ?? null
}

/** The first Sales account assigned to a doctor, used to attribute new Dental Lab rows. */
export async function getDoctorSalesAccount(doctorId: number) {
  const [sales] = await getDb()
    .select({ id: adminUsers.id, fullName: adminUsers.fullName, username: adminUsers.username })
    .from(salesDoctorAssignments)
    .innerJoin(adminUsers, eq(adminUsers.id, salesDoctorAssignments.salesId))
    .where(eq(salesDoctorAssignments.doctorId, doctorId))
    .orderBy(asc(salesDoctorAssignments.createdAt))
    .limit(1)
  return sales ?? null
}
