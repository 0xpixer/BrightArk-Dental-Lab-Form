import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { appSettings } from '@/lib/db/schema'
import { isAdminRole } from '@/lib/admin/roles'
import { parseSalesTargets, SALES_TARGETS_KEY } from '@/lib/overview/admin'

const targetsSchema = z.object({
  targets: z.array(z.object({ salesId: z.number().int().positive(), target: z.number().int().min(0).max(10_000) })).max(500),
})

/** Monthly new-case targets per sales account. Admin and superadmin only. */
export async function PUT(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!isAdminRole(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = targetsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter whole numbers between 0 and 10,000' }, { status: 400 })

  const value = JSON.stringify(Object.fromEntries(parsed.data.targets.filter((row) => row.target > 0).map((row) => [row.salesId, row.target])))
  const now = new Date()
  const userId = Number(session!.user.id)
  await getDb().insert(appSettings)
    .values({ key: SALES_TARGETS_KEY, value, updatedBy: userId, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: userId, updatedAt: now } })
  return NextResponse.json({ targets: parseSalesTargets(value) })
}
