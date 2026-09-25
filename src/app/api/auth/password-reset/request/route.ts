import { and, eq, or, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { adminUsers, pendingPasswordResets } from '@/lib/db/schema'
import {
  cleanupPasswordResetsQuery,
  passwordResetRequestSchema,
  savePasswordResetQuery,
  sendPasswordResetEmail,
} from '@/lib/passwordReset'
import {
  checkTurnstile,
  createVerification,
  emailLimitIdentity,
  readSignupJson,
  requestIp,
  signupConfig,
  SignupError,
} from '@/lib/signup/security'
import { limitSignup } from '@/lib/signup/store'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const config = signupConfig()
    await limitSignup(config.secret, 'password-reset-ip', requestIp(request), 10)
    const parsed = passwordResetRequestSchema.safeParse(await readSignupJson(request))
    if (!parsed.success) throw new SignupError('Enter a valid email and complete the security check.')

    const { email, turnstileToken } = parsed.data
    await checkTurnstile(turnstileToken, config, fetch, 'password-reset')
    const emailIdentity = emailLimitIdentity(email)
    await limitSignup(config.secret, 'password-reset-email-minute', emailIdentity, 1, 60)
    await limitSignup(config.secret, 'password-reset-email-hour', emailIdentity, 3)

    const db = getDb()
    await db.execute(cleanupPasswordResetsQuery())
    const [account] = await db.select({
      id: adminUsers.id,
      username: adminUsers.username,
      email: adminUsers.email,
    }).from(adminUsers).where(and(
      eq(adminUsers.isActive, true),
      or(sql`lower(${adminUsers.email}) = ${email}`, sql`lower(${adminUsers.username}) = ${email}`),
    )).limit(1)

    const { id, code, codeHash } = createVerification(config.secret)
    if (account) {
      const destination = account.email ?? account.username
      const validDestination = passwordResetRequestSchema.shape.email.safeParse(destination)
      if (validDestination.success) {
        await db.execute(savePasswordResetQuery(id, account.id, codeHash))
        try {
          await sendPasswordResetEmail(validDestination.data, code, id, config)
        } catch (error) {
          await db.delete(pendingPasswordResets).where(eq(pendingPasswordResets.id, id))
          throw error
        }
      }
    }

    return NextResponse.json({
      success: true,
      resetId: id,
      message: 'If an active account matches that email, a reset code has been sent.',
    }, { status: 202 })
  } catch (error) {
    if (error instanceof SignupError) return NextResponse.json({ error: error.message }, {
      status: error.status,
      headers: error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : undefined,
    })
    console.error('Password reset request failed')
    return NextResponse.json({ error: 'Unable to request a password reset right now. Please try again later.' }, { status: 503 })
  }
}
