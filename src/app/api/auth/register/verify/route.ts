import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { readSignupJson, requestIp, secretHash, signupConfig, SignupError, verificationSchema } from '@/lib/signup/security'
import { completeRegistrationQuery, limitSignup, verificationAttemptQuery } from '@/lib/signup/store'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const config = signupConfig()
    await limitSignup(config.secret, 'verify-ip', requestIp(request), 30)
    const parsed = verificationSchema.safeParse(await readSignupJson(request))
    if (!parsed.success) throw new SignupError('Enter the six-digit code from your email.')
    const { registrationId, code } = parsed.data
    const db = getDb()
    const attempt = await db.execute(verificationAttemptQuery(registrationId))
    if (!attempt.rows.length) throw new SignupError('This code has expired or has too many attempts. Request a new code.')
    const created = await db.execute(completeRegistrationQuery(registrationId, secretHash(config.secret, registrationId, code)))
    if (!created.rows.length) throw new SignupError('Invalid or already used code. Try again, or sign in if you already verified.')
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    if (error instanceof SignupError) return NextResponse.json({ error: error.message }, {
      status: error.status, headers: error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : undefined,
    })
    console.error('Email verification failed')
    return NextResponse.json({ error: 'Unable to verify right now. Please try again.' }, { status: 503 })
  }
}
