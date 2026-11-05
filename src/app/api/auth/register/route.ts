import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { eq, or } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers, pendingRegistrations } from '@/lib/db/schema'
import { checkTurnstile, createVerificationLink, emailLimitIdentity, readSignupJson, registrationSchema, requestIp, sendVerificationEmail, signupConfig, SignupError } from '@/lib/signup/security'
import { REGISTRATION_LINK_TTL_MS } from '@/lib/signup/constants'
import { cleanupSignupData, limitSignup } from '@/lib/signup/store'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const config = signupConfig()
    await limitSignup(config.secret, 'register-ip', requestIp(request), 10)
    const parsed = registrationSchema.safeParse(await readSignupJson(request))
    if (!parsed.success) throw new SignupError('Check your name, clinic, email, password (8-72 characters), and security check.')
    const { turnstileToken, ...values } = parsed.data
    await checkTurnstile(turnstileToken, config)
    const emailIdentity = emailLimitIdentity(values.email)
    await limitSignup(config.secret, 'register-email-minute', emailIdentity, 1, 60)
    await limitSignup(config.secret, 'register-email-hour', emailIdentity, 3)
    const db = getDb()
    const [existing] = await db.select({ id: adminUsers.id }).from(adminUsers)
      .where(or(eq(adminUsers.email, values.email), eq(adminUsers.username, values.email))).limit(1)
    if (existing) throw new SignupError('An account with this email already exists. Please sign in.', 409)
    await cleanupSignupData()
    const { id, token, tokenHash } = createVerificationLink(config.secret)
    const { password, ...profile } = values
    await db.insert(pendingRegistrations).values({
      ...profile, id, codeHash: tokenHash, passwordHash: await bcrypt.hash(password, 12),
      expiresAt: new Date(Date.now() + REGISTRATION_LINK_TTL_MS),
    })
    const verificationUrl = `${config.appUrl}/register/verify?registrationId=${id}&token=${token}`
    try { await sendVerificationEmail(values.email, verificationUrl, id, config) }
    catch (error) {
      await db.delete(pendingRegistrations).where(eq(pendingRegistrations.id, id))
      throw error
    }
    return NextResponse.json({ success: true, verificationRequired: true, registrationId: id }, { status: 202 })
  } catch (error) {
    if (error instanceof SignupError) return NextResponse.json({ error: error.message }, {
      status: error.status, headers: error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : undefined,
    })
    // Raw database errors can include pending credentials. Do not log them.
    console.error('Doctor registration failed')
    return NextResponse.json({ error: 'Unable to register right now. Please try again later.' }, { status: 503 })
  }
}
