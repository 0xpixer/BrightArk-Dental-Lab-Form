import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { financeAccess } from '@/lib/db/schema'
import { financePasswordSchema, hashResetToken, signUnlockToken } from '@/lib/finance/access'
import { financeLockSecret, getFinanceAccessRow } from '@/lib/finance/accessServer'

export const runtime = 'nodejs'

const schema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: financePasswordSchema })

/** Sets a new Finance password from an emailed link; the link only works for the account it was sent to. */
export async function POST(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  const userId = Number(session!.user.id)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    const message = parsed.error.issues.find((issue) => issue.path[0] === 'password')?.message
    return NextResponse.json({ error: message ?? 'This reset link is invalid' }, { status: 400 })
  }

  const secret = financeLockSecret()
  const own = await getFinanceAccessRow(userId)
  const valid = own?.resetTokenHash === hashResetToken(secret, parsed.data.token) && own.resetExpiresAt && own.resetExpiresAt.getTime() > Date.now()
  if (!own || !valid) return NextResponse.json({ error: 'This reset link has expired or belongs to another account. Request a new one from the Finance page.' }, { status: 400 })

  const version = own.passwordVersion + 1
  await getDb().update(financeAccess).set({
    passwordHash: await bcrypt.hash(parsed.data.password, 12),
    passwordVersion: version,
    failedAttempts: 0,
    lockedUntil: null,
    resetTokenHash: null,
    resetExpiresAt: null,
    updatedAt: new Date(),
  }).where(eq(financeAccess.userId, userId))
  return NextResponse.json({ success: true, unlockToken: signUnlockToken(secret, userId, version) })
}
