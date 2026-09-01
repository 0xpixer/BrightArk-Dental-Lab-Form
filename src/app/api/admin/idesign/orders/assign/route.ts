import { and, eq, ilike, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireSuperadmin } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { adminUsers, idesignOrders } from '@/lib/db/schema'

export async function POST(request: Request) {
  const { session, error } = await requireSuperadmin()
  if (error) return error

  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const accountId = Number(body?.accountId)
  const filters = body?.filters && typeof body.filters === 'object' ? body.filters as Record<string, unknown> : {}
  const salesperson = textValue(filters.salesperson)
  const doctor = textValue(filters.doctor)
  if (!Number.isInteger(accountId) || accountId <= 0) return NextResponse.json({ error: 'Select an account' }, { status: 400 })
  if (!salesperson && !doctor) return NextResponse.json({ error: 'Filter by Sales or Doctor before assigning orders' }, { status: 400 })

  const db = getDb()
  const [account] = await db.select({ id: adminUsers.id, role: adminUsers.role }).from(adminUsers).where(and(eq(adminUsers.id, accountId), eq(adminUsers.isActive, true))).limit(1)
  if (!account || !['sales', 'doctor'].includes(account.role)) {
    return NextResponse.json({ error: 'Choose an active Sales or Doctor account' }, { status: 400 })
  }

  const conditions = []
  if (salesperson) conditions.push(eq(idesignOrders.salespersonName, salesperson))
  if (doctor) conditions.push(eq(idesignOrders.doctorName, doctor))
  const category = textValue(filters.category)
  const progress = textValue(filters.progress)
  const country = textValue(filters.country)
  const search = textValue(filters.search)
  if (category) conditions.push(eq(idesignOrders.category, category))
  if (progress) conditions.push(eq(idesignOrders.latestProgress, progress))
  if (country) conditions.push(eq(idesignOrders.country, country))
  if (search) {
    const pattern = `%${search}%`
    conditions.push(or(ilike(idesignOrders.caseId, pattern), ilike(idesignOrders.patientName, pattern), ilike(idesignOrders.doctorName, pattern), ilike(idesignOrders.salespersonName, pattern))!)
  }

  const assignment = account.role === 'sales'
    ? { salesAccountId: account.id, assignmentUpdatedBy: Number(session!.user.id), assignmentUpdatedAt: new Date() }
    : { doctorAccountId: account.id, assignmentUpdatedBy: Number(session!.user.id), assignmentUpdatedAt: new Date() }
  const updated = await db.update(idesignOrders).set(assignment).where(and(...conditions)).returning({ id: idesignOrders.id })
  return NextResponse.json({ success: true, assigned: updated.length, assignmentRole: account.role })
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
