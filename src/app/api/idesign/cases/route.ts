import { and, count, desc, ilike, inArray, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { adminUsers, idesignCases } from '@/lib/db/schema'
import { canViewIDesign, getIDesignCaseAccessCondition } from '@/lib/idesign/access'
import { createIDesignCaseOrderNo, createIDesignCaseSchema } from '@/lib/idesign/cases'
import { getOrderOwnerId } from '@/lib/portal/access'

export async function GET(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canViewIDesign(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))
  const search = searchParams.get('search')?.trim()
  const conditions = []
  const accessCondition = await getIDesignCaseAccessCondition(Number(session!.user.id), session!.user.role)
  if (accessCondition) conditions.push(accessCondition)
  if (search) {
    const pattern = `%${search}%`
    conditions.push(or(ilike(idesignCases.orderNo, pattern), ilike(idesignCases.patientName, pattern))!)
  }
  const where = conditions.length ? and(...conditions) : undefined
  const db = getDb()
  const [rows, totalRows] = await Promise.all([
    db.select().from(idesignCases).where(where).orderBy(desc(idesignCases.createdAt), desc(idesignCases.id)).limit(limit).offset((page - 1) * limit),
    db.select({ count: count() }).from(idesignCases).where(where),
  ])
  const accountIds = [...new Set(rows.flatMap((row) => [row.createdBy, row.doctorAccountId, row.salesAccountId]).filter((id): id is number => Boolean(id)))]
  const accounts = accountIds.length
    ? await db.select({ id: adminUsers.id, name: adminUsers.fullName, username: adminUsers.username }).from(adminUsers).where(inArray(adminUsers.id, accountIds))
    : []
  const accountNames = new Map(accounts.map((account) => [account.id, account.name || account.username]))
  const total = totalRows[0]?.count ?? 0

  return NextResponse.json({
    cases: rows.map((row) => ({
      ...row,
      createdByName: row.createdBy ? accountNames.get(row.createdBy) ?? null : null,
      doctorName: row.doctorAccountId ? accountNames.get(row.doctorAccountId) ?? null : null,
      salesName: row.salesAccountId ? accountNames.get(row.salesAccountId) ?? null : null,
    })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  })
}

export async function POST(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canViewIDesign(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = createIDesignCaseSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the highlighted fields', details: parsed.error.flatten() }, { status: 400 })
  }

  const userId = Number(session!.user.id)
  const role = session!.user.role
  const doctorAccountId = role === 'doctor' || role === 'clinic_staff' ? await getOrderOwnerId(userId, role) : null
  if ((role === 'doctor' || role === 'clinic_staff') && !doctorAccountId) {
    return NextResponse.json({ error: 'This account is not linked to a doctor profile' }, { status: 403 })
  }

  const [created] = await getDb().insert(idesignCases).values({
    orderNo: createIDesignCaseOrderNo(),
    orderType: 'clear_aligner',
    ...parsed.data,
    createdBy: userId,
    doctorAccountId,
    salesAccountId: role === 'sales' ? userId : null,
  }).returning()

  return NextResponse.json({ case: created }, { status: 201 })
}
