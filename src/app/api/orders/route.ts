import { NextResponse } from 'next/server'
import { eq, desc, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { mapPayloadToOrderInsert, type OrderApiPayload } from '@/lib/transformOrder'
import { requireAdmin, requirePortalUser } from '@/lib/admin/session'
import { getOrderOwnerId } from '@/lib/portal/access'

function todayOrderPrefix(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const day = parts.find((part) => part.type === 'day')?.value ?? ''
  return `${year}${month}${day}`
}

async function generateDailyOrderNo(db: ReturnType<typeof getDb>): Promise<string> {
  const prefix = todayOrderPrefix()
  const [latest] = await db
    .select({ orderNo: orders.orderNo })
    .from(orders)
    .where(sql`${orders.orderNo} like ${`${prefix}%`}`)
    .orderBy(desc(orders.orderNo))
    .limit(1)

  const latestSequence = latest?.orderNo.startsWith(prefix)
    ? Number.parseInt(latest.orderNo.slice(8), 10)
    : 0
  const nextSequence = Number.isFinite(latestSequence) ? latestSequence + 1 : 1

  if (nextSequence > 99) {
    throw new Error('Daily order limit reached. Please contact BrightArk.')
  }

  return `${prefix}${String(nextSequence).padStart(2, '0')}`
}

export async function POST(request: Request) {
  try {
    const { session, error } = await requirePortalUser()
    if (error) return error
    const ownerId = await getOrderOwnerId(parseInt(session!.user.id, 10), session!.user.role)
    if (!ownerId) {
      return NextResponse.json({ success: false, error: 'Clinic staff must be linked to a doctor before submitting orders' }, { status: 403 })
    }
    const body = (await request.json()) as OrderApiPayload

    if (!body.dentist || !body.clinic || !body.patient || !body.email) {
      return NextResponse.json(
        { success: false, error: 'Dentist, clinic, email, and patient name are required' },
        { status: 400 },
      )
    }

    const db = getDb()
    const orderNo = await generateDailyOrderNo(db)
    const orderData = mapPayloadToOrderInsert({ ...body, orderNo })
    const [inserted] = await db.insert(orders).values({ ...orderData, submittedBy: ownerId }).returning({
      orderNo: orders.orderNo,
    })

    return NextResponse.json(
      { success: true, orderNo: inserted.orderNo },
      { status: 201 },
    )
  } catch (error) {
    console.error('Order insert failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create order',
      },
      { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  try {
    const { error } = await requireAdmin()
    if (error) return error
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const db = getDb()
    const rows = status
      ? await db
          .select()
          .from(orders)
          .where(eq(orders.status, status))
          .orderBy(desc(orders.createdAt))
      : await db.select().from(orders).orderBy(desc(orders.createdAt))

    return NextResponse.json({ success: true, orders: rows })
  } catch (error) {
    console.error('Order fetch failed:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch orders',
      },
      { status: 500 },
    )
  }
}
