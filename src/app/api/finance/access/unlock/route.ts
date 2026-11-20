import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { financeAccess } from '@/lib/db/schema'
import { FINANCE_LOCKOUT_MS, FINANCE_MAX_FAILED_ATTEMPTS, signUnlockToken } from '@/lib/finance/access'
import { financeLockSecret, loadFinanceGate } from '@/lib/finance/accessServer'

export const runtime = 'nodejs'

const schema = z.object({ password: z.string().min(1).max(200) })

/** Checks the Finance password and returns a token the page keeps in memory for this visit. */
export async function POST(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  const userId = Number(session!.user.id)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter your Finance password' }, { status: 400 })

  const { own, gate } = await loadFinanceGate(userId, session!.user.role)
  if (gate.hidden) return NextResponse.json({ error: 'Finance is not shared with clinic staff', code: 'finance_hidden' }, { status: 403 })
  if (!own?.passwordHash) return NextResponse.json({ success: true, unlockToken: null })
  const now = Date.now()
  if (own.lockedUntil && own.lockedUntil.getTime() > now) {
    const minutes = Math.ceil((own.lockedUntil.getTime() - now) / 60000)
    return NextResponse.json({ error: `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'} or reset your password.` }, { status: 429 })
  }

  const db = getDb()
  if (!await bcrypt.compare(parsed.data.password, own.passwordHash)) {
    const attempts = own.failedAttempts + 1
    const locked = attempts >= FINANCE_MAX_FAILED_ATTEMPTS
    await db.update(financeAccess)
      .set({ failedAttempts: locked ? 0 : attempts, lockedUntil: locked ? new Date(now + FINANCE_LOCKOUT_MS) : own.lockedUntil })
      .where(eq(financeAccess.userId, userId))
    return NextResponse.json({ error: locked
      ? 'Too many wrong passwords. Try again in 15 minutes or reset your password.'
      : `Wrong password. ${FINANCE_MAX_FAILED_ATTEMPTS - attempts} attempt${FINANCE_MAX_FAILED_ATTEMPTS - attempts === 1 ? '' : 's'} left.` }, { status: locked ? 429 : 401 })
  }
  if (own.failedAttempts || own.lockedUntil) await db.update(financeAccess).set({ failedAttempts: 0, lockedUntil: null }).where(eq(financeAccess.userId, userId))
  return NextResponse.json({ success: true, unlockToken: signUnlockToken(financeLockSecret(), userId, own.passwordVersion) })
}
