import { NextResponse } from 'next/server'
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm'
import { requireSession, requireSuperadmin } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { idesignOrders } from '@/lib/db/schema'
import { applyIDesignOrderLogic, createIDesignOrderSchema } from '@/lib/idesign/orders'
import { adminUsers } from '@/lib/db/schema'
import { canViewIDesign, getIDesignAccessCondition } from '@/lib/idesign/access'

export async function GET(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canViewIDesign(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))
  const search = searchParams.get('search')?.trim()
  const category = searchParams.get('category')?.trim()
  const progress = searchParams.get('progress')?.trim()
  const country = searchParams.get('country')?.trim()
  const salesperson = searchParams.get('salesperson')?.trim()
  const doctor = searchParams.get('doctor')?.trim()
  const conditions = []
  const accessCondition = await getIDesignAccessCondition(Number(session!.user.id), session!.user.role)
  if (accessCondition) conditions.push(accessCondition)

  if (category) conditions.push(eq(idesignOrders.category, category))
  if (progress) conditions.push(eq(idesignOrders.latestProgress, progress))
  if (country) conditions.push(eq(idesignOrders.country, country))
  if (salesperson) conditions.push(eq(idesignOrders.salespersonName, salesperson))
  if (doctor) conditions.push(eq(idesignOrders.doctorName, doctor))
  if (search) {
    const pattern = `%${search}%`
    conditions.push(or(
      ilike(idesignOrders.caseId, pattern),
      ilike(idesignOrders.patientName, pattern),
      ilike(idesignOrders.doctorName, pattern),
      ilike(idesignOrders.salespersonName, pattern),
    )!)
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined
  const db = getDb()
  const optionCondition = accessCondition
  const [rows, totalRows, salespeople, doctors, products, assignableAccounts] = await Promise.all([
    db.select().from(idesignOrders).where(where).orderBy(desc(idesignOrders.sourceCreatedOn), desc(idesignOrders.id)).limit(limit).offset((page - 1) * limit),
    db.select({ count: count() }).from(idesignOrders).where(where),
    db.selectDistinct({ name: idesignOrders.salespersonName }).from(idesignOrders).where(optionCondition).orderBy(asc(idesignOrders.salespersonName)),
    db.selectDistinct({ name: idesignOrders.doctorName }).from(idesignOrders).where(optionCondition).orderBy(asc(idesignOrders.doctorName)),
    db.selectDistinct({ name: idesignOrders.purchasedProducts }).from(idesignOrders).where(optionCondition).orderBy(asc(idesignOrders.purchasedProducts)),
    session!.user.role === 'superadmin'
      ? db.select({ id: adminUsers.id, fullName: adminUsers.fullName, username: adminUsers.username, role: adminUsers.role }).from(adminUsers).where(and(or(eq(adminUsers.role, 'sales'), eq(adminUsers.role, 'doctor')), eq(adminUsers.isActive, true))).orderBy(asc(adminUsers.fullName), asc(adminUsers.username))
      : Promise.resolve([]),
  ])

  const total = totalRows[0]?.count ?? 0
  return NextResponse.json({
    orders: rows,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    options: {
      salespeople: salespeople.map((row) => row.name),
      doctors: doctors.map((row) => row.name),
      products: products.flatMap((row) => row.name ? [row.name] : []),
      assignableAccounts: assignableAccounts.map((account) => ({ id: account.id, name: account.fullName || account.username, role: account.role })),
    },
    permissions: { canAssign: session!.user.role === 'superadmin', canCreate: session!.user.role === 'superadmin' },
  })
}

export async function POST(request: Request) {
  const { session, error } = await requireSuperadmin()
  if (error) return error

  const parsed = createIDesignOrderSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the highlighted fields', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const [order] = await getDb()
    .insert(idesignOrders)
    .values({ ...applyIDesignOrderLogic(parsed.data), createdBy: Number(session!.user.id) })
    .returning()

  return NextResponse.json({ order }, { status: 201 })
}
