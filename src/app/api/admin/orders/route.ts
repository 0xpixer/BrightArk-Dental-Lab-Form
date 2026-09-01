import { NextResponse } from 'next/server'
import { desc, eq, or, ilike, and, count, getTableColumns, lte, notInArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { requireDashboardUser } from '@/lib/admin/session'
import { redactOrderForLabAdmin } from '@/lib/admin/orderVisibility'
import { hasUnreadOrderMessage } from '@/lib/orderUnread'
import { normalizeOrderStatusFilters, ORDER_STATUS_DUE_MS, ORDER_TERMINAL_STATUSES } from '@/lib/orderStatus'
import { getDashboardOrderAccessCondition } from '@/lib/sales/access'

export async function GET(request: Request) {
  const { session, error } = await requireDashboardUser()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const offset = (page - 1) * limit
  const statuses = normalizeOrderStatusFilters(searchParams.getAll('status'))
  const search = searchParams.get('search')?.trim()
  const sortBy = searchParams.get('sortBy') ?? 'createdAt'
  const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc'

  const conditions = []
  const userId = Number(session!.user.id)
  const accessCondition = await getDashboardOrderAccessCondition(userId, session!.user.role)
  if (accessCondition) conditions.push(accessCondition)
  if (statuses.length > 0) {
    const statusConditions = statuses.map((status) => status === 'overdue'
      ? and(
        notInArray(orders.status, ORDER_TERMINAL_STATUSES),
        lte(orders.statusUpdatedAt, new Date(Date.now() - ORDER_STATUS_DUE_MS)),
      )!
      : eq(orders.status, status))
    conditions.push(or(...statusConditions)!)
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
            : sortBy === 'statusUpdatedAt'
              ? orders.statusUpdatedAt
              : orders.createdAt

  const orderByClause = sortDir === 'asc' ? sortColumn : desc(sortColumn)

  const [rows, totalResult] = await Promise.all([
    db
      .select({ ...getTableColumns(orders), hasUnreadMessage: hasUnreadOrderMessage(userId) })
      .from(orders)
      .where(where)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(orders).where(where),
  ])

  const total = totalResult[0]?.count ?? 0

  return NextResponse.json({
    orders: session!.user.role === 'admin' ? rows.map(redactOrderForLabAdmin) : rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
