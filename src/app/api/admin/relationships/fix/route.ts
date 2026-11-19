import { NextResponse } from 'next/server'
import { eq, asc } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '@/lib/db/client'
import { adminUsers, salesDoctorAssignments } from '@/lib/db/schema'
import { requireSuperadmin } from '@/lib/admin/session'
import { findRelationshipIssues, fixRelationshipIssues, loadOrderSalesLinks } from '@/lib/relationships/server'

const schema = z.object({ doctorIds: z.array(z.number().int().positive()).max(500).optional() })

/** Moves the listed doctors' mismatched orders to the doctor's sales rep (every doctor when none are listed). */
export async function POST(request: Request) {
  const { session, error } = await requireSuperadmin()
  if (error) return error
  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const db = getDb()
  // Recomputed on the server so a stale page cannot apply an outdated fix.
  const [doctors, assignments, links] = await Promise.all([
    db.select({ id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.role, 'doctor')),
    db.select().from(salesDoctorAssignments).orderBy(asc(salesDoctorAssignments.createdAt), asc(salesDoctorAssignments.salesId)),
    loadOrderSalesLinks(),
  ])
  const doctorSales = new Map<number, number | null>(doctors.map((doctor) => [doctor.id, null]))
  for (const assignment of assignments) if (doctorSales.get(assignment.doctorId) === null) doctorSales.set(assignment.doctorId, assignment.salesId)
  const wanted = parsed.data.doctorIds ? new Set(parsed.data.doctorIds) : null
  // Doctors without a rep are assigned explicitly on the page, never by a bulk fix.
  const issues = findRelationshipIssues(doctorSales, links)
    .filter((issue) => issue.kind !== 'unassigned_with_orders' && (!wanted || wanted.has(issue.doctorId)))
  const result = await fixRelationshipIssues(issues, Number(session!.user.id))
  return NextResponse.json({ success: true, ...result })
}
