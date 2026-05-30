import { NextResponse } from 'next/server'
import { eq, desc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { orders } from '@/lib/db/schema'
import { mapPayloadToOrderInsert, type OrderApiPayload } from '@/lib/transformOrder'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as OrderApiPayload

    if (!body.dentist || !body.clinic || !body.patient) {
      return NextResponse.json(
        { success: false, error: 'Dentist, clinic, and patient name are required' },
        { status: 400 },
      )
    }

    const orderData = mapPayloadToOrderInsert(body)
    const db = getDb()
    const [inserted] = await db.insert(orders).values(orderData).returning({
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
