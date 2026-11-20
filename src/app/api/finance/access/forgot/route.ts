import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { adminUsers, financeAccess } from '@/lib/db/schema'
import { accountEmail, appLink, sendTransactionalEmail } from '@/lib/email'
import { FINANCE_RESET_TTL_MS, hashResetToken, maskEmail } from '@/lib/finance/access'
import { financeLockSecret, loadFinanceGate } from '@/lib/finance/accessServer'

export const runtime = 'nodejs'
export const maxDuration = 30

/** Emails the signed-in account a link to set a new Finance password. */
export async function POST() {
  const { session, error } = await requireSession()
  if (error) return error
  const userId = Number(session!.user.id)
  const { own, gate } = await loadFinanceGate(userId, session!.user.role)
  if (gate.hidden || !own?.passwordHash) return NextResponse.json({ error: 'There is no Finance password to reset' }, { status: 400 })
  if (own.resetSentAt && Date.now() - own.resetSentAt.getTime() < 60_000) {
    return NextResponse.json({ error: 'A reset email was just sent. Please wait a minute before asking again.' }, { status: 429 })
  }

  const db = getDb()
  const [account] = await db.select({ email: adminUsers.email, username: adminUsers.username, fullName: adminUsers.fullName })
    .from(adminUsers).where(eq(adminUsers.id, userId)).limit(1)
  const email = account ? accountEmail(account) : null
  if (!email) return NextResponse.json({ error: 'This account has no email address. Please contact BrightArk to reset your Finance password.' }, { status: 400 })

  const token = randomBytes(32).toString('hex')
  const link = appLink(`/portal/finance/reset?token=${token}`)
  if (!link) return NextResponse.json({ error: 'Password reset email is not available right now. Please contact BrightArk.' }, { status: 503 })
  const now = new Date()
  await db.update(financeAccess)
    .set({ resetTokenHash: hashResetToken(financeLockSecret(), token), resetExpiresAt: new Date(now.getTime() + FINANCE_RESET_TTL_MS), resetSentAt: now })
    .where(eq(financeAccess.userId, userId))

  const sent = await sendTransactionalEmail({
    to: email,
    subject: 'Reset your BrightArk Finance password',
    text: `Hi${account?.fullName ? ` ${account.fullName}` : ''},\n\nWe received a request to reset the password that protects your Finance page in the BrightArk portal.\n\nOpen this link to set a new Finance password (it expires in 30 minutes):\n${link}\n\nYou will need to be signed in to the portal with this account. If you did not ask for this, you can ignore this email; your Finance password has not changed.`,
  })
  if (!sent) {
    await db.update(financeAccess).set({ resetTokenHash: null, resetExpiresAt: null, resetSentAt: null }).where(eq(financeAccess.userId, userId))
    return NextResponse.json({ error: 'Could not send the reset email. Please try again in a minute.' }, { status: 503 })
  }
  return NextResponse.json({ success: true, email: maskEmail(email) })
}
