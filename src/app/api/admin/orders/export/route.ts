import { and, asc, desc, eq, ilike, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/session'
import { generateSubmissionsWorkbook } from '@/lib/admin/generateSubmissionsWorkbook'
import { getDb } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { ORDER_STATUS_LABELS } from '@/lib/orderStatus'

export const runtime = 'nodejs'

function formatExportDate(value: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(value)
}

export async function GET(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')?.trim()
  const sortBy = searchParams.get('sortBy') ?? 'createdAt'
  const sortDirection = searchParams.get('sortDir') === 'asc' ? asc : desc
  const conditions = []
  if (status && status !== 'all') conditions.push(eq(orders.status, status))
  if (search) {
    const pattern = `%${search}%`
    conditions.push(or(ilike(orders.orderNo, pattern), ilike(orders.dentist, pattern), ilike(orders.patientName, pattern))!)
  }

  const sortColumn = sortBy === 'orderNo' ? orders.orderNo
    : sortBy === 'dentist' ? orders.dentist
      : sortBy === 'patientName' ? orders.patientName
        : sortBy === 'status' ? orders.status
          : sortBy === 'statusUpdatedAt' ? orders.statusUpdatedAt
            : orders.createdAt

  const db = getDb()
  const rows = await db.select({
    patientName: orders.patientName,
    orderNo: orders.orderNo,
    statusUpdatedAt: orders.statusUpdatedAt,
    createdAt: orders.createdAt,
    dentist: orders.dentist,
    status: orders.status,
  }).from(orders).where(conditions.length ? and(...conditions) : undefined).orderBy(sortDirection(sortColumn))

  const workbook = await generateSubmissionsWorkbook(rows.map((row) => ({
    patientName: row.patientName,
    orderNo: row.orderNo,
    statusUpdatedAt: formatExportDate(row.statusUpdatedAt),
    submittedAt: formatExportDate(row.createdAt),
    dentist: row.dentist,
    status: ORDER_STATUS_LABELS[row.status] ?? row.status,
  })))
  const filename = `brightark-submissions-${new Date().toISOString().slice(0, 10)}.xlsx`
  return new NextResponse(new Uint8Array(workbook), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
