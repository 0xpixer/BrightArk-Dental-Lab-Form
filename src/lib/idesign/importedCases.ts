import { and, eq, inArray, isNull } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { idesignCases, idesignOrders } from '@/lib/db/schema'

/**
 * Rows of idesign_orders that came from the spreadsheet import (or were added by hand in Finance),
 * as opposed to Finance rows auto-created for a new case or Dental Lab order.
 */
export const importedOrderRecordsOnly = and(isNull(idesignOrders.caseId), isNull(idesignOrders.dentalOrderId))!

export async function syncImportedIDesignCases(orderIds: number[]) {
  if (orderIds.length === 0) return []
  const db = getDb()
  const orders = await db.select({
    id: idesignOrders.id,
    category: idesignOrders.category,
    patientName: idesignOrders.patientName,
    latestProgress: idesignOrders.latestProgress,
    createdBy: idesignOrders.createdBy,
    doctorAccountId: idesignOrders.doctorAccountId,
    salesAccountId: idesignOrders.salesAccountId,
    createdAt: idesignOrders.createdAt,
    updatedAt: idesignOrders.updatedAt,
  }).from(idesignOrders).where(and(inArray(idesignOrders.id, orderIds), importedOrderRecordsOnly))

  const alignerOrders = orders.filter((order) => order.category === 'iAlign')
  if (alignerOrders.length === 0) return []

  await db.insert(idesignCases).values(alignerOrders.map((order) => ({
    importedOrderId: order.id,
    orderNo: importedCaseOrderNo(order.id),
    orderType: 'clear_aligner',
    patientName: order.patientName,
    latestProgress: order.latestProgress,
    createdBy: order.createdBy,
    doctorAccountId: order.doctorAccountId,
    salesAccountId: order.salesAccountId,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }))).onConflictDoNothing({ target: idesignCases.importedOrderId })

  await Promise.all(alignerOrders.map((order) => db.update(idesignCases).set({
    patientName: order.patientName,
    latestProgress: order.latestProgress,
    doctorAccountId: order.doctorAccountId,
    salesAccountId: order.salesAccountId,
    updatedAt: new Date(),
  }).where(eq(idesignCases.importedOrderId, order.id))))

  return db.select().from(idesignCases).where(inArray(idesignCases.importedOrderId, alignerOrders.map((order) => order.id)))
}

export function importedCaseOrderNo(orderId: number) {
  return `IMP-${String(orderId).padStart(8, '0')}`
}
