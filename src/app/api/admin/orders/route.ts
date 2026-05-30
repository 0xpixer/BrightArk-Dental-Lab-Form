import { NextResponse } from 'next/server'
import { desc, eq, or, ilike, and, count } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { requireSession } from '@/lib/admin/session'

export async function GET(request: Request) {
  const { error } = await requireSession()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const offset = (page - 1) * limit
  const status = searchParams.get('status')
  const search = searchParams.get('search')?.trim()
  const sortBy = searchParams.get('sortBy') ?? 'createdAt'
  const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc'

  const conditions = []
  if (status && status !== 'all') {
    conditions.push(eq(orders.status, status))
  }
  if (search) {
    const pattern = `%${search}%`
    conditions.push(
      or(
        ilike(orders.orderNo, pattern),
        ilike(orders.dentist, pattern),
        ilike(orders.patientName, pattern),
      )!,
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const db = getDb()

  const sortColumn =
    sortBy === 'orderNo'
      ? orders.orderNo
      : sortBy === 'dentist'
        ? orders.dentist
        : sortBy === 'patientName'
          ? orders.patientName
          : sortBy === 'status'
            ? orders.status
            : orders.createdAt

  const orderByClause = sortDir === 'asc' ? sortColumn : desc(sortColumn)

  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(where)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(orders).where(where),
  ])

  const total = totalResult[0]?.count ?? 0

  return NextResponse.json({
    orders: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
