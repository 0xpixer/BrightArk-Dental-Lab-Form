import { eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { idesignCases, idesignOrders } from '@/lib/db/schema'

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
  }).from(idesignOrders).where(inArray(idesignOrders.id, orderIds))

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
