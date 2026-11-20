import { NextResponse } from 'next/server'
import { eq, inArray } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { financeAccess } from '@/lib/db/schema'
import { isPortalRole } from '@/lib/admin/roles'
import { getOrderOwnerId } from '@/lib/portal/access'
import { FINANCE_UNLOCK_HEADER, resolveFinanceGate, verifyUnlockToken, type FinanceAccessRow } from './access'

export function financeLockSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('AUTH_SECRET is not configured')
  return secret
}

export async function getFinanceAccessRow(userId: number) {
  const [row] = await getDb().select().from(financeAccess).where(eq(financeAccess.userId, userId)).limit(1)
  return row ?? null
}

/** The viewer's own lock row plus, for clinic staff, the linked doctor's row (which holds the staff switch). */
export async function loadFinanceGate(userId: number, role: string) {
  const doctorId = role === 'clinic_staff' ? await getOrderOwnerId(userId, role) : null
  const ids = doctorId ? [userId, doctorId] : [userId]
  const rows = await getDb().select().from(financeAccess).where(inArray(financeAccess.userId, ids))
  const own = rows.find((row) => row.userId === userId) ?? null
  const doctor = doctorId ? rows.find((row) => row.userId === doctorId) ?? null : null
  return { own, gate: resolveFinanceGate(role, own as FinanceAccessRow | null, doctor as FinanceAccessRow | null) }
}

/** Token from the page's header, or from ?unlock= on links the browser opens itself (invoice downloads). */
export function readUnlockToken(request: Request) {
  return request.headers.get(FINANCE_UNLOCK_HEADER) ?? new URL(request.url).searchParams.get('unlock')
}

/**
 * Blocks finance data for portal accounts whose Finance is hidden (staff) or locked by a password
 * the request has not unlocked. Returns null when the request may go on.
 */
export async function financeLockError(request: Request, userId: number, role: string) {
  if (!isPortalRole(role)) return null
  const { own, gate } = await loadFinanceGate(userId, role)
  if (gate.hidden) return NextResponse.json({ error: 'Finance is not shared with clinic staff', code: 'finance_hidden' }, { status: 403 })
  if (gate.hasPassword && !verifyUnlockToken(financeLockSecret(), readUnlockToken(request), userId, own!.passwordVersion)) {
    return NextResponse.json({ error: 'Enter your Finance password', code: 'finance_locked' }, { status: 401 })
  }
  return null
}
