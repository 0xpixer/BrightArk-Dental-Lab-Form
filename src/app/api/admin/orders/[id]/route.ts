import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { larkNotifications, orders, sharedLinks } from '@/lib/db/schema'
import { requireAdmin, requireSuperadmin } from '@/lib/admin/session'
import { redactOrderForLabAdmin } from '@/lib/admin/orderVisibility'

const VALID_STATUSES = new Set(['pending', 'in_progress', 'complete'])

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
  }

  const db = getDb()
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({
    order: session!.user.role === 'admin' ? redactOrderForLabAdmin(order) : order,
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { session, error } = await requireAdmin()
  if (error) return error

  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
  }

  const body = await request.json()
  const isSuperadmin = session!.user.role === 'superadmin'
  if (!isSuperadmin && (Object.keys(body).length !== 1 || body.status === undefined)) {
    return NextResponse.json({ error: 'Lab Admins can only update order status' }, { status: 403 })
  }
  const db = getDb()

  const updateData: Record<string, unknown> = {}

  if (body.status !== undefined) {
    if (!VALID_STATUSES.has(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    updateData.status = body.status
  }
  if (body.dentist !== undefined) updateData.dentist = body.dentist
  if (body.clinic !== undefined) updateData.clinic = body.clinic
  if (body.email !== undefined) updateData.email = body.email
  if (body.altEmail !== undefined) updateData.altEmail = body.altEmail || null
  if (body.phone !== undefined) updateData.phone = body.phone || null
  if (body.address !== undefined) updateData.address = body.address
  if (body.billingAddress !== undefined) updateData.billingAddress = body.billingAddress || null
  if (body.patientName !== undefined) updateData.patientName = body.patientName
  if (body.patientDob !== undefined) updateData.patientDob = body.patientDob || null
  if (body.patientAge !== undefined) updateData.patientAge = body.patientAge || null
  if (body.sex !== undefined) updateData.sex = body.sex
  if (body.dateRequired !== undefined) updateData.dateRequired = body.dateRequired
  if (body.isRepair !== undefined) updateData.isRepair = body.isRepair
  if (body.isRedo !== undefined) updateData.isRedo = body.isRedo
  if (body.isUrgent !== undefined) updateData.isUrgent = body.isUrgent
  if (body.oldOrderNo !== undefined) updateData.oldOrderNo = body.oldOrderNo
  if (body.treatmentType !== undefined) updateData.treatmentType = body.treatmentType
  if (body.treatmentData !== undefined) updateData.treatmentData = body.treatmentData
  if (body.toothSelection !== undefined) updateData.toothSelection = body.toothSelection
  if (body.instructions !== undefined) updateData.instructions = body.instructions
  if (body.fileUrls !== undefined) updateData.fileUrls = body.fileUrls
  if (body.cloudDriveLink !== undefined) updateData.cloudDriveLink = body.cloudDriveLink || null

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const [updated] = await db
    .update(orders)
    .set(updateData)
    .where(eq(orders.id, id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, order: updated })
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const { error } = await requireSuperadmin()
  if (error) return error

  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
  }

  try {
    const db = getDb()
    await db.delete(sharedLinks).where(eq(sharedLinks.orderId, id))
    await db.delete(larkNotifications).where(eq(larkNotifications.orderId, id))

    const [deleted] = await db
      .delete(orders)
      .where(eq(orders.id, id))
      .returning({ id: orders.id })

    if (!deleted) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Order delete failed:', error)
    return NextResponse.json({ error: 'Failed to delete order' }, { status: 500 })
  }
}
