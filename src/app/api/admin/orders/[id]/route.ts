import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { larkNotifications, orderActivities, orders, sharedLinks } from '@/lib/db/schema'
import { requireAdmin, requireSuperadmin } from '@/lib/admin/session'
import { redactOrderForLabAdmin } from '@/lib/admin/orderVisibility'
import { ORDER_STATUS_VALUES } from '@/lib/orderStatus'
import { normalizeOrderNote } from '@/lib/orderActivity'
import { getOrderActivityActorName } from '@/lib/orderActivityActor'

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
  const [[order], activities] = await Promise.all([
    db.select().from(orders).where(eq(orders.id, id)).limit(1),
    db.select().from(orderActivities).where(eq(orderActivities.orderId, id)).orderBy(desc(orderActivities.createdAt)),
  ])

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({
    order: session!.user.role === 'admin' ? redactOrderForLabAdmin(order) : order,
    activities,
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
  const labAdminFields = new Set(['status', 'notes'])
  if (!isSuperadmin && Object.keys(body).some((field) => !labAdminFields.has(field))) {
    return NextResponse.json({ error: 'Lab Admins can only update order status and notes' }, { status: 403 })
  }
  const db = getDb()

  const updateData: Record<string, unknown> = {}
  const [existingOrder] = await db.select({ status: orders.status, notes: orders.notes }).from(orders).where(eq(orders.id, id)).limit(1)
  if (!existingOrder) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  let statusChanged = false
  let noteChanged = false
  let normalizedNote: string | null | undefined

  if (body.status !== undefined) {
    if (!ORDER_STATUS_VALUES.has(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    updateData.status = body.status
    statusChanged = existingOrder.status !== body.status
    if (statusChanged) updateData.statusUpdatedAt = new Date()
  }
  if (body.notes !== undefined) {
    const parsedNote = normalizeOrderNote(body.notes)
    if (parsedNote.error) return NextResponse.json({ error: parsedNote.error }, { status: 400 })
    normalizedNote = parsedNote.value
    noteChanged = (existingOrder.notes ?? null) !== normalizedNote
    updateData.notes = normalizedNote
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
  if (body.cloudDriveLinks !== undefined) updateData.cloudDriveLinks = body.cloudDriveLinks

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const actorId = Number(session!.user.id)
  const actorName = await getOrderActivityActorName(actorId, isSuperadmin ? 'Superadmin' : 'Lab Admin')
  const activities = []
  if (statusChanged) {
    activities.push({ orderId: id, eventType: 'status', detail: body.status, actorId, actorRole: session!.user.role, actorName })
  }
  if (noteChanged && normalizedNote) {
    activities.push({ orderId: id, eventType: 'note', detail: normalizedNote, actorId, actorRole: session!.user.role, actorName })
  }

  let updated
  if (activities.length > 0) {
    const [updatedRows] = await db.batch([
      db.update(orders).set(updateData).where(eq(orders.id, id)).returning(),
      db.insert(orderActivities).values(activities),
    ])
    updated = updatedRows[0]
  } else {
    const [updatedRow] = await db.update(orders).set(updateData).where(eq(orders.id, id)).returning()
    updated = updatedRow
  }

  if (!updated) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, order: session!.user.role === 'admin' ? redactOrderForLabAdmin(updated) : updated })
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
