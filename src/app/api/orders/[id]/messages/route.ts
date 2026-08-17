import { asc, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/session'
import { isAdminRole, isPortalRole } from '@/lib/admin/roles'
import { getDb } from '@/lib/db/client'
import { orderMessages, orders, type OrderMessage } from '@/lib/db/schema'
import { getMessageAuthor, parseOrderMessage } from '@/lib/orderMessages'
import { getAccessiblePortalOrder } from '@/lib/portal/orderAccess'

function serializeMessage(message: OrderMessage, viewerId: number) {
  return {
    id: message.id,
    author: getMessageAuthor(message.senderRole) ?? 'Admin',
    message: message.message,
    createdAt: message.createdAt,
    isOwn: message.senderId === viewerId,
  }
}

async function canAccessOrder(orderId: number, userId: number, role: string) {
  if (isAdminRole(role)) {
    const db = getDb()
    const [order] = await db.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)).limit(1)
    return Boolean(order)
  }
  if (isPortalRole(role)) return Boolean(await getAccessiblePortalOrder(orderId, userId, role))
  return false
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  const orderId = Number(params.id)
  const userId = Number(session!.user.id)
  const role = session!.user.role
  if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(userId)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
  }
  if (!await canAccessOrder(orderId, userId, role)) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const db = getDb()
  const messages = await db
    .select()
    .from(orderMessages)
    .where(eq(orderMessages.orderId, orderId))
    .orderBy(asc(orderMessages.createdAt), asc(orderMessages.id))

  return NextResponse.json({ messages: messages.map((message) => serializeMessage(message, userId)) })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error

  const orderId = Number(params.id)
  const userId = Number(session!.user.id)
  const role = session!.user.role
  if (!Number.isInteger(orderId) || orderId <= 0 || !Number.isInteger(userId)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
  }
  if (!getMessageAuthor(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!await canAccessOrder(orderId, userId, role)) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const message = parseOrderMessage(body?.message)
  if (!message) {
    return NextResponse.json({ error: 'Enter a message of up to 2,000 characters' }, { status: 400 })
  }

  const db = getDb()
  const [created] = await db
    .insert(orderMessages)
    .values({ orderId, senderId: userId, senderRole: role, message })
    .returning()

  return NextResponse.json({ message: serializeMessage(created, userId) }, { status: 201 })
}
