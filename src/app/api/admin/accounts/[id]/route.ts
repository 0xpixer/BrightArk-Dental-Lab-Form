import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers, idesignOrders, salesDoctorAssignments } from '@/lib/db/schema'
import { requireSuperadmin } from '@/lib/admin/session'
import { isAccountRole } from '@/lib/admin/roles'
import { canViewAccount, normalizeActorName } from '@/lib/admin/accountIdentity'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { session, error } = await requireSuperadmin()
  if (error) return error

  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid account ID' }, { status: 400 })
  }

  const body = await request.json()
  const currentUserId = parseInt(session!.user.id, 10)
  const isSelf = id === currentUserId
  if (isSelf && Object.keys(body).some((field) => field !== 'fullName')) {
    return NextResponse.json({ error: 'Use My Profile to change your own account settings' }, { status: 400 })
  }

  const db = getDb()
  const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1)

  if (!existing || !canViewAccount(session!.user.username, existing.username)) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  const updateData: Partial<typeof adminUsers.$inferInsert> = {}

  if (body.fullName !== undefined) {
    const parsedName = normalizeActorName(body.fullName)
    if (parsedName.error) return NextResponse.json({ error: parsedName.error }, { status: 400 })
    updateData.fullName = parsedName.value
  }

  if (body.isActive !== undefined) {
    updateData.isActive = Boolean(body.isActive)
  }

  if (body.role !== undefined) {
    if (!isAccountRole(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    updateData.role = body.role
  }

  if (body.linkedDoctorId !== undefined) {
    const linkedDoctorId = body.linkedDoctorId === null || body.linkedDoctorId === '' ? null : Number(body.linkedDoctorId)
    if (linkedDoctorId !== null) {
      const [doctor] = await db.select({ id: adminUsers.id }).from(adminUsers).where(and(eq(adminUsers.id, linkedDoctorId), eq(adminUsers.role, 'doctor'))).limit(1)
      if (!doctor) return NextResponse.json({ error: 'Linked doctor not found' }, { status: 400 })
    }
    updateData.linkedDoctorId = linkedDoctorId
  }

  if (body.password) {
    if (body.password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    updateData.passwordHash = await bcrypt.hash(body.password, 12)
  }

  const nextRole = updateData.role ?? existing.role
  const nextIsActive = updateData.isActive ?? existing.isActive

  if (existing.role === 'superadmin' && existing.isActive && (nextRole !== 'superadmin' || !nextIsActive)) {
    const superadmins = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(and(eq(adminUsers.role, 'superadmin'), eq(adminUsers.isActive, true)))

    const activeSuperadminCount = superadmins.length
    if (activeSuperadminCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove or deactivate the last active superadmin' },
        { status: 400 },
      )
    }
  }

  if (Object.keys(updateData).length === 0) {
    if (body.servedDoctorIds === undefined) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }
  }

  let servedDoctorIds: number[] | undefined
  if (body.servedDoctorIds !== undefined) {
    if (nextRole !== 'sales' || !Array.isArray(body.servedDoctorIds)) {
      return NextResponse.json({ error: 'Served doctors can only be assigned to Sales accounts' }, { status: 400 })
    }
    const parsedServedDoctorIds = [
      ...new Set<number>(body.servedDoctorIds.map((value: unknown) => Number(value))),
    ]
    if (parsedServedDoctorIds.some((doctorId) => !Number.isInteger(doctorId) || doctorId <= 0)) {
      return NextResponse.json({ error: 'Invalid served doctor list' }, { status: 400 })
    }
    servedDoctorIds = parsedServedDoctorIds
    if (parsedServedDoctorIds.length > 0) {
      const doctors = await db.select({ id: adminUsers.id }).from(adminUsers).where(and(inArray(adminUsers.id, parsedServedDoctorIds), eq(adminUsers.role, 'doctor'), eq(adminUsers.isActive, true)))
      if (doctors.length !== parsedServedDoctorIds.length) {
        return NextResponse.json({ error: 'One or more served doctors are unavailable' }, { status: 400 })
      }
    }
  }

  const [updated] = await db
    .update(adminUsers)
    .set(updateData)
    .where(eq(adminUsers.id, id))
    .returning({
      id: adminUsers.id,
      username: adminUsers.username,
      fullName: adminUsers.fullName,
      role: adminUsers.role,
      linkedDoctorId: adminUsers.linkedDoctorId,
      isActive: adminUsers.isActive,
    })

  if (!updated) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  }

  if (nextRole !== 'sales') {
    await db.delete(salesDoctorAssignments).where(eq(salesDoctorAssignments.salesId, id))
  } else if (servedDoctorIds !== undefined) {
    await db.delete(salesDoctorAssignments).where(eq(salesDoctorAssignments.salesId, id))
    if (servedDoctorIds.length > 0) {
      await db.insert(salesDoctorAssignments).values(servedDoctorIds.map((doctorId) => ({
        salesId: id,
        doctorId,
        assignedBy: currentUserId,
      })))
    }
  }
  if (nextRole !== 'doctor') {
    await db.delete(salesDoctorAssignments).where(eq(salesDoctorAssignments.doctorId, id))
  }
  if (existing.role === 'sales' && nextRole !== 'sales') {
    await db.update(idesignOrders).set({ salesAccountId: null, assignmentUpdatedBy: currentUserId, assignmentUpdatedAt: new Date() }).where(eq(idesignOrders.salesAccountId, id))
  }
  if (existing.role === 'doctor' && nextRole !== 'doctor') {
    await db.update(idesignOrders).set({ doctorAccountId: null, assignmentUpdatedBy: currentUserId, assignmentUpdatedAt: new Date() }).where(eq(idesignOrders.doctorAccountId, id))
  }

  return NextResponse.json({
    success: true,
    account: updated,
    temporaryPassword: body.password ?? undefined,
  })
}
