import { NextResponse } from 'next/server'
import { and, eq, desc, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers, orderActivities, orders } from '@/lib/db/schema'
import { mapPayloadToOrderInsert } from '@/lib/transformOrder'
import { parseOrderSubmission } from '@/lib/orderSubmission'
import { requireAdmin, requireSession } from '@/lib/admin/session'
import { isAdminRole, isPortalRole, isSalesRole } from '@/lib/admin/roles'
import { getOrderOwnerId } from '@/lib/portal/access'
import { getOrderActivityActorName } from '@/lib/orderActivityActor'
import { isDoctorAssignedToSales } from '@/lib/sales/access'

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
    const { session, error } = await requireSession()
    if (error) return error
    const body = await request.json()

    const parsed = parseOrderSubmission(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.reason === 'files'
            ? 'One or more uploaded file links are invalid. Please upload those files again.'
            : 'Please complete the required form fields',
        },
        { status: 400 },
      )
    }

    const db = getDb()
    let ownerId: number | null = null
    if (isPortalRole(session!.user.role)) {
      ownerId = await getOrderOwnerId(parseInt(session!.user.id, 10), session!.user.role)
      if (!ownerId) {
        return NextResponse.json({ success: false, error: 'Clinic staff must be linked to a doctor before submitting orders' }, { status: 403 })
      }
    } else if (isAdminRole(session!.user.role) || isSalesRole(session!.user.role)) {
      const doctorId = Number(parsed.values.submittedForDoctorId)
      if (!Number.isInteger(doctorId) || doctorId <= 0) {
        return NextResponse.json({ success: false, error: 'Select the doctor this case is for' }, { status: 400 })
      }
      const [doctor] = await db
        .select({ id: adminUsers.id })
        .from(adminUsers)
        .where(and(eq(adminUsers.id, doctorId), eq(adminUsers.role, 'doctor'), eq(adminUsers.isActive, true)))
        .limit(1)
      if (!doctor) {
        return NextResponse.json({ success: false, error: 'Selected doctor is unavailable' }, { status: 400 })
      }
      if (isSalesRole(session!.user.role) && !await isDoctorAssignedToSales(Number(session!.user.id), doctor.id)) {
        return NextResponse.json({ success: false, error: 'This doctor is not assigned to your Sales account' }, { status: 403 })
      }
      ownerId = doctor.id
    } else {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const orderNo = await generateDailyOrderNo(db)
    const orderData = mapPayloadToOrderInsert({
      ...parsed.values,
      orderNo,
      file_urls: parsed.fileUrls,
    })
    const [inserted] = await db.insert(orders).values({ ...orderData, submittedBy: ownerId }).returning({
      id: orders.id,
      orderNo: orders.orderNo,
    })
    const actorId = Number(session!.user.id)
    const actorName = await getOrderActivityActorName(actorId, session!.user.username || 'User')
    await db.insert(orderActivities).values({
      orderId: inserted.id,
      eventType: 'status',
      detail: 'pending',
      actorId,
      actorRole: session!.user.role,
      actorName,
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
