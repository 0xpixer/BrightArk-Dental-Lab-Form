import { NextResponse } from 'next/server'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/lib/db/client'
import { adminUsers } from '@/lib/db/schema'
import { requireSuperadmin } from '@/lib/admin/session'
import { isSalesRole } from '@/lib/admin/roles'
import { setDoctorSales } from '@/lib/relationships/server'

const schema = z.object({
  doctorIds: z.array(z.number().int().positive()).min(1).max(500),
  salesId: z.number().int().positive().nullable(),
  moveOrders: z.boolean().default(true),
})

/** Sets the sales rep of one or more doctors; their existing orders follow when moveOrders is on. */
export async function PUT(request: Request) {
  const { session, error } = await requireSuperadmin()
  if (error) return error
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Choose doctors and a sales rep' }, { status: 400 })
  const { doctorIds, salesId, moveOrders } = parsed.data
  const db = getDb()
  const doctors = await db.select({ id: adminUsers.id }).from(adminUsers).where(and(inArray(adminUsers.id, doctorIds), eq(adminUsers.role, 'doctor')))
  if (doctors.length !== new Set(doctorIds).size) return NextResponse.json({ error: 'One or more doctors are unavailable' }, { status: 400 })
  if (salesId) {
    const [sales] = await db.select({ role: adminUsers.role, isActive: adminUsers.isActive }).from(adminUsers).where(eq(adminUsers.id, salesId)).limit(1)
    if (!sales || !isSalesRole(sales.role) || !sales.isActive) return NextResponse.json({ error: 'Choose an active sales account' }, { status: 400 })
  }
  const result = await setDoctorSales(doctorIds, salesId, Number(session!.user.id), { moveOrders })
  return NextResponse.json({ success: true, ...result })
}
