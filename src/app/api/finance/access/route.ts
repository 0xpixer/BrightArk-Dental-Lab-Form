import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { requireSession } from '@/lib/admin/session'
import { isPortalRole } from '@/lib/admin/roles'
import { getDb } from '@/lib/db/client'
import { adminUsers, financeAccess } from '@/lib/db/schema'
import { accountEmail } from '@/lib/email'
import { financeSettingsSchema, maskEmail, signUnlockToken, verifyUnlockToken } from '@/lib/finance/access'
import { financeLockSecret, loadFinanceGate, readUnlockToken } from '@/lib/finance/accessServer'

export const runtime = 'nodejs'

/** The viewer's Finance lock state: hidden, first-visit setup, password. */
export async function GET() {
  const { session, error } = await requireSession()
  if (error) return error
  const role = session!.user.role
  const userId = Number(session!.user.id)
  if (!isPortalRole(role)) return NextResponse.json({ role, hidden: false, needsSetup: false, hasPassword: false, staffVisible: null, email: null })
  const [{ gate }, [account]] = await Promise.all([
    loadFinanceGate(userId, role),
    getDb().select({ email: adminUsers.email, username: adminUsers.username }).from(adminUsers).where(eq(adminUsers.id, userId)).limit(1),
  ])
  const email = account ? accountEmail(account) : null
  return NextResponse.json({ role, ...gate, email: email ? maskEmail(email) : null })
}

/** Saves the setup window / Settings: password (none, keep, set) and, for doctors, whether clinic staff see Finance. */
export async function PUT(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  const role = session!.user.role
  const userId = Number(session!.user.id)
  if (!isPortalRole(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = financeSettingsSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid settings' }, { status: 400 })

  const { own, gate } = await loadFinanceGate(userId, role)
  if (gate.hidden) return NextResponse.json({ error: 'Finance is not shared with clinic staff', code: 'finance_hidden' }, { status: 403 })
  const secret = financeLockSecret()
  // Changing an existing lock needs the page to be unlocked with the current password.
  if (gate.hasPassword && !verifyUnlockToken(secret, readUnlockToken(request), userId, own!.passwordVersion)) {
    return NextResponse.json({ error: 'Enter your Finance password', code: 'finance_locked' }, { status: 401 })
  }

  const { passwordMode, password, staffVisible } = parsed.data
  if (passwordMode === 'keep' && !gate.hasPassword) return NextResponse.json({ error: 'Choose whether to set a password' }, { status: 400 })
  const now = new Date()
  const version = (own?.passwordVersion ?? 0) + (passwordMode === 'keep' ? 0 : 1)
  const values = {
    ...(passwordMode === 'keep' ? {} : {
      passwordHash: passwordMode === 'set' ? await bcrypt.hash(password!, 12) : null,
      passwordVersion: version,
      failedAttempts: 0,
      lockedUntil: null,
      resetTokenHash: null,
      resetExpiresAt: null,
    }),
    ...(role === 'doctor' && staffVisible !== undefined ? { staffVisible } : {}),
    setupAt: own?.setupAt ?? now,
    updatedAt: now,
  }
  await getDb().insert(financeAccess).values({ userId, ...values })
    .onConflictDoUpdate({ target: financeAccess.userId, set: values })

  const hasPassword = passwordMode === 'keep' ? gate.hasPassword : passwordMode === 'set'
  return NextResponse.json({ success: true, hasPassword, unlockToken: hasPassword ? signUnlockToken(secret, userId, version) : null })
}
