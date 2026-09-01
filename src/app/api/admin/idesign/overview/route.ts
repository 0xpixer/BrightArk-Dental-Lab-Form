import { NextResponse } from 'next/server'
import { and, asc, eq } from 'drizzle-orm'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { idesignOrders } from '@/lib/db/schema'
import { buildIDesignMetrics } from '@/lib/idesign/metrics'
import { getIDesignAccessCondition } from '@/lib/idesign/access'
import { isSalesRole } from '@/lib/admin/roles'

export async function GET(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  if (session!.user.role !== 'superadmin' && !isSalesRole(session!.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || 'iAlign'
  const salesperson = searchParams.get('salesperson')?.trim()
  const doctor = searchParams.get('doctor')?.trim()
  const conditions = []
  const accessCondition = await getIDesignAccessCondition(Number(session!.user.id), session!.user.role)
  if (accessCondition) conditions.push(accessCondition)
  if (category !== 'all') conditions.push(eq(idesignOrders.category, category))
  if (salesperson) conditions.push(eq(idesignOrders.salespersonName, salesperson))
  if (doctor) conditions.push(eq(idesignOrders.doctorName, doctor))
  const where = conditions.length > 0 ? and(...conditions) : undefined
  const db = getDb()

  const [rows, salespeople, doctors] = await Promise.all([
    db.select({
      sourceCreatedOn: idesignOrders.sourceCreatedOn,
      latestProgress: idesignOrders.latestProgress,
      paymentStatus: idesignOrders.paymentStatus,
      category: idesignOrders.category,
    }).from(idesignOrders).where(where),
    db.selectDistinct({ name: idesignOrders.salespersonName }).from(idesignOrders).where(accessCondition).orderBy(asc(idesignOrders.salespersonName)),
    db.selectDistinct({ name: idesignOrders.doctorName }).from(idesignOrders).where(accessCondition).orderBy(asc(idesignOrders.doctorName)),
  ])

  return NextResponse.json({
    metrics: buildIDesignMetrics(rows),
    options: { salespeople: salespeople.map((row) => row.name), doctors: doctors.map((row) => row.name) },
    generatedAt: new Date().toISOString(),
  })
}
