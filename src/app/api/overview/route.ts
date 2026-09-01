import { NextResponse } from 'next/server'
import { and, asc, desc, eq, isNull, or } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers, orders } from '@/lib/db/schema'
import { requireSession } from '@/lib/admin/session'
import { isAdminRole, isPortalRole, isSalesRole } from '@/lib/admin/roles'
import { getDoctorProfile, getOrderOwnerId } from '@/lib/portal/access'
import { buildOverviewMetrics, type OverviewGranularity } from '@/lib/overviewMetrics'
import { latestOrderMessageAt, unreadLatestOrderMessageCondition } from '@/lib/orderUnread'
import { getSalesDoctors, getSalesOrderAccessCondition } from '@/lib/sales/access'

function doctorOrderCondition(doctorId: number, email?: string | null) {
  return email
    ? or(eq(orders.submittedBy, doctorId), and(isNull(orders.submittedBy), eq(orders.email, email)))
    : eq(orders.submittedBy, doctorId)
}

export async function GET(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const granularity: OverviewGranularity = searchParams.get('granularity') === 'week' ? 'week' : 'month'
  const role = session!.user.role
  const userId = Number(session!.user.id)
  const db = getDb()

  let accessCondition: ReturnType<typeof doctorOrderCondition> | undefined
  let scopeLabel = 'All lab orders'
  let selectedDoctorId: number | null = null

  if (isPortalRole(role)) {
    const ownerId = await getOrderOwnerId(userId, role)
    if (!ownerId) {
      return NextResponse.json({ error: 'Clinic staff is not linked to a doctor' }, { status: 403 })
    }
    const doctor = await getDoctorProfile(ownerId)
    accessCondition = doctorOrderCondition(ownerId, doctor?.email)
    scopeLabel = doctor?.fullName ? `${doctor.fullName}'s orders` : 'Your clinic orders'
  } else if (isAdminRole(role)) {
    const requestedDoctorId = Number(searchParams.get('doctorId'))
    if (role === 'superadmin' && Number.isInteger(requestedDoctorId) && requestedDoctorId > 0) {
      const [doctor] = await db
        .select({ id: adminUsers.id, email: adminUsers.email, fullName: adminUsers.fullName, username: adminUsers.username })
        .from(adminUsers)
        .where(and(eq(adminUsers.id, requestedDoctorId), eq(adminUsers.role, 'doctor'), eq(adminUsers.isActive, true)))
        .limit(1)
      if (!doctor) return NextResponse.json({ error: 'Selected doctor is unavailable' }, { status: 400 })
      selectedDoctorId = doctor.id
      accessCondition = doctorOrderCondition(doctor.id, doctor.email)
      scopeLabel = `${doctor.fullName || doctor.username}'s orders`
    }
  } else if (isSalesRole(role)) {
    const salesDoctors = await getSalesDoctors(userId)
    accessCondition = await getSalesOrderAccessCondition(userId)
    scopeLabel = 'Orders for your served doctors'
    const requestedDoctorId = Number(searchParams.get('doctorId'))
    if (Number.isInteger(requestedDoctorId) && requestedDoctorId > 0) {
      const doctor = salesDoctors.find((candidate) => candidate.id === requestedDoctorId)
      if (!doctor) return NextResponse.json({ error: 'Selected doctor is unavailable' }, { status: 400 })
      selectedDoctorId = doctor.id
      accessCondition = and(accessCondition, doctorOrderCondition(doctor.id, doctor.email))
      scopeLabel = `${doctor.fullName || doctor.email || 'Doctor'}'s orders`
    }
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const latestMessageAt = latestOrderMessageAt()
  const [rows, doctorRows, newMessages] = await Promise.all([
    db
      .select({ status: orders.status, createdAt: orders.createdAt, statusUpdatedAt: orders.statusUpdatedAt })
      .from(orders)
      .where(accessCondition),
    role === 'superadmin'
      ? db
          .select({ id: adminUsers.id, fullName: adminUsers.fullName, username: adminUsers.username })
          .from(adminUsers)
          .where(and(eq(adminUsers.role, 'doctor'), eq(adminUsers.isActive, true)))
          .orderBy(asc(adminUsers.fullName), asc(adminUsers.username))
      : isSalesRole(role)
        ? getSalesDoctors(userId)
        : Promise.resolve([]),
    db
      .select({
        orderId: orders.id,
        orderNo: orders.orderNo,
        patientName: orders.patientName,
        latestMessageAt,
      })
      .from(orders)
      .where(and(accessCondition, unreadLatestOrderMessageCondition(userId)))
      .orderBy(desc(latestMessageAt)),
  ])

  return NextResponse.json({
    metrics: buildOverviewMetrics(rows, granularity),
    scopeLabel,
    canFilterDoctors: role === 'superadmin' || isSalesRole(role),
    selectedDoctorId,
    doctors: doctorRows.map((doctor) => ({ id: doctor.id, name: doctor.fullName || ('username' in doctor ? doctor.username : doctor.email) || 'Doctor' })),
    newMessages,
    generatedAt: new Date().toISOString(),
  })
}
