import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { clearLoginRateLimit } from '@/lib/admin/rateLimit'
import { completePasswordResetQuery, passwordResetAttemptQuery, passwordResetConfirmSchema } from '@/lib/passwordReset'
import { readSignupJson, requestIp, secretHash, signupConfig, SignupError } from '@/lib/signup/security'
import { limitSignup } from '@/lib/signup/store'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const config = signupConfig()
    await limitSignup(config.secret, 'password-reset-verify-ip', requestIp(request), 30)
    const parsed = passwordResetConfirmSchema.safeParse(await readSignupJson(request))
    if (!parsed.success) throw new SignupError('Enter the six-digit code and a new password of 8-72 characters.')

    const { resetId, code, password } = parsed.data
    const db = getDb()
    const attempt = await db.execute(passwordResetAttemptQuery(resetId))
    if (!attempt.rows.length) throw new SignupError('This code has expired or has too many attempts. Request a new code.')

    const updated = await db.execute(completePasswordResetQuery(
      resetId,
      secretHash(config.secret, resetId, code),
      await bcrypt.hash(password, 12),
    ))
    const account = updated.rows[0] as { username?: string } | undefined
    if (!account?.username) throw new SignupError('The code is invalid. Please check it and try again.')

    clearLoginRateLimit(account.username)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof SignupError) return NextResponse.json({ error: error.message }, {
      status: error.status,
      headers: error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : undefined,
    })
    console.error('Password reset confirmation failed')
    return NextResponse.json({ error: 'Unable to reset the password right now. Please try again later.' }, { status: 503 })
  }
}
