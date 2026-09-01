import { NextResponse } from 'next/server'
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm'
import { requireSuperadmin } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { idesignOrders } from '@/lib/db/schema'
import { applyIDesignOrderLogic, createIDesignOrderSchema } from '@/lib/idesign/orders'

export async function GET(request: Request) {
  const { error } = await requireSuperadmin()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))
  const search = searchParams.get('search')?.trim()
  const category = searchParams.get('category')?.trim()
  const progress = searchParams.get('progress')?.trim()
  const country = searchParams.get('country')?.trim()
  const conditions = []

  if (category) conditions.push(eq(idesignOrders.category, category))
  if (progress) conditions.push(eq(idesignOrders.latestProgress, progress))
  if (country) conditions.push(eq(idesignOrders.country, country))
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
  const [rows, totalRows, salespeople, doctors, products] = await Promise.all([
    db.select().from(idesignOrders).where(where).orderBy(desc(idesignOrders.sourceCreatedOn), desc(idesignOrders.id)).limit(limit).offset((page - 1) * limit),
    db.select({ count: count() }).from(idesignOrders).where(where),
    db.selectDistinct({ name: idesignOrders.salespersonName }).from(idesignOrders).orderBy(asc(idesignOrders.salespersonName)),
    db.selectDistinct({ name: idesignOrders.doctorName }).from(idesignOrders).orderBy(asc(idesignOrders.doctorName)),
    db.selectDistinct({ name: idesignOrders.purchasedProducts }).from(idesignOrders).orderBy(asc(idesignOrders.purchasedProducts)),
  ])

  const total = totalRows[0]?.count ?? 0
  return NextResponse.json({
    orders: rows,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    options: {
      salespeople: salespeople.map((row) => row.name),
      doctors: doctors.map((row) => row.name),
      products: products.flatMap((row) => row.name ? [row.name] : []),
    },
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
