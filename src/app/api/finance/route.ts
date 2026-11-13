import { NextResponse } from 'next/server'
import { and, count, desc, eq, ilike, or, type SQL } from 'drizzle-orm'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { idesignCases, idesignOrders } from '@/lib/db/schema'
import { canManageFinance, canViewFinance, financeRowSchema, financeRowValues, FINANCE_CATEGORIES, FINANCE_PAYMENT_STATUSES, isAllowedInvoiceUrl } from '@/lib/finance/finance'
import {
  financeBaseQuery,
  financeOverdueCondition,
  getActiveDoctor,
  getActiveDoctors,
  getDoctorSalesAccount,
  getFinanceOverdueDays,
  getFinanceScope,
  serializeFinanceRow,
} from '@/lib/finance/server'

export async function GET(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  const role = session!.user.role
  if (!canViewFinance(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const userId = Number(session!.user.id)
  const canManage = canManageFinance(role)
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 25))
  const search = searchParams.get('search')?.trim()
  const category = searchParams.get('category')?.trim()
  const status = searchParams.get('status')?.trim()
  const overdueOnly = searchParams.get('overdue') === '1'
  const today = new Date().toISOString().slice(0, 10)

  const [scope, overdueDays] = await Promise.all([getFinanceScope(userId, role), getFinanceOverdueDays()])
  const conditions: SQL[] = []
  if (scope) conditions.push(scope)
  if (category) conditions.push(eq(idesignOrders.category, category))
  if (status) conditions.push(eq(idesignOrders.paymentStatus, status))
  if (overdueOnly) conditions.push(financeOverdueCondition(overdueDays, today))
  if (search) {
    const pattern = `%${search}%`
    conditions.push(or(
      ilike(idesignOrders.patientName, pattern),
      ilike(idesignOrders.orderNo, pattern),
      ilike(idesignCases.orderNo, pattern),
      ilike(idesignOrders.invoiceNo, pattern),
      ilike(idesignOrders.purchasedProducts, pattern),
      ...(canManage ? [ilike(idesignOrders.doctorName, pattern)] : []),
    )!)
  }
  const where = conditions.length ? and(...conditions) : undefined

  const db = getDb()
  const [rows, totals, doctors] = await Promise.all([
    financeBaseQuery().where(where).orderBy(desc(idesignOrders.sourceCreatedOn), desc(idesignOrders.id)).limit(limit).offset((page - 1) * limit),
    db.select({ count: count() }).from(idesignOrders).leftJoin(idesignCases, eq(idesignCases.importedOrderId, idesignOrders.id)).where(where),
    canManage ? getActiveDoctors() : Promise.resolve([]),
  ])
  const total = totals[0]?.count ?? 0

  return NextResponse.json({
    rows: rows.map((row) => serializeFinanceRow(row, overdueDays, canManage, today)),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    overdueDays,
    canManage,
    options: {
      categories: FINANCE_CATEGORIES,
      paymentStatuses: FINANCE_PAYMENT_STATUSES,
      doctors: doctors.map((doctor) => ({ id: doctor.id, name: doctor.fullName || doctor.username, clinicName: doctor.clinicName })),
    },
  })
}

export async function POST(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageFinance(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = financeRowSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid finance record' }, { status: 400 })
  const input = parsed.data
  if (!input.doctorAccountId) return NextResponse.json({ error: 'Assign the record to a doctor' }, { status: 400 })
  if (!isAllowedInvoiceUrl(input.invoiceFileUrl)) return NextResponse.json({ error: 'Upload the invoice file again' }, { status: 400 })

  const doctor = await getActiveDoctor(input.doctorAccountId)
  if (!doctor) return NextResponse.json({ error: 'Choose an active doctor account' }, { status: 400 })
  const sales = await getDoctorSalesAccount(doctor.id)
  const userId = Number(session!.user.id)
  const today = new Date().toISOString().slice(0, 10)

  const [created] = await getDb().insert(idesignOrders).values({
    ...financeRowValues(input),
    doctorAccountId: doctor.id,
    doctorName: doctor.fullName || doctor.username,
    salesAccountId: sales?.id ?? null,
    salespersonName: sales ? sales.fullName || sales.username : '-',
    country: doctor.country || '-',
    latestProgress: 'Entering Info',
    sourceCreatedOn: today,
    sourceUpdatedOn: today,
    createdBy: userId,
    assignmentUpdatedBy: userId,
    assignmentUpdatedAt: new Date(),
  }).returning({ id: idesignOrders.id })

  return NextResponse.json({ success: true, id: created.id }, { status: 201 })
}
