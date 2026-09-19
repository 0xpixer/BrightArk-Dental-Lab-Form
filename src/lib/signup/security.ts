import { createHmac, randomBytes, randomInt } from 'node:crypto'
import { isIP } from 'node:net'
import { z } from 'zod'

export const registrationSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(72).refine((value) => Buffer.byteLength(value) <= 72, 'Password must be at most 72 bytes'),
  fullName: z.string().trim().min(1).max(150),
  clinicName: z.string().trim().min(1).max(200),
  address: z.string().trim().max(1000).default(''),
  phone: z.string().trim().max(50).default(''),
  turnstileToken: z.string().min(1).max(2048),
})

export const verificationSchema = z.object({
  registrationId: z.string().regex(/^[a-f0-9]{64}$/),
  code: z.string().trim().regex(/^\d{6}$/),
})

export class SignupError extends Error {
  constructor(message: string, public status = 400, public retryAfter?: number) { super(message) }
}

export function signupConfig() {
  const secret = process.env.TURNSTILE_SECRET_KEY
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const hosts = (process.env.TURNSTILE_ALLOWED_HOSTNAMES ?? '').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean)
  if (!hosts.length && process.env.APP_URL) hosts.push(new URL(process.env.APP_URL).hostname)
  if (!secret || !apiKey || !from || !hosts.length || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    throw new SignupError('New account registration is temporarily unavailable. Please contact BrightArk.', 503)
  }
  return { secret, apiKey, from, hosts }
}

export function requestIp(request: Request, onVercel = process.env.VERCEL === '1') {
  // Only trust forwarding headers when Vercel is the trusted ingress.
  const value = onVercel ? request.headers.get('x-vercel-forwarded-for') ?? request.headers.get('x-forwarded-for') : null
  const ip = value?.split(',')[0].trim()
  return ip && isIP(ip) ? ip : 'unknown'
}

export function emailLimitIdentity(email: string) {
  const [local, domain] = email.toLowerCase().split('@')
  return domain === 'gmail.com' || domain === 'googlemail.com'
    ? `${local.split('+')[0].replace(/\./g, '')}@gmail.com`
    : email.toLowerCase()
}

export function secretHash(secret: string, purpose: string, value: string) {
  return createHmac('sha256', secret).update(`${purpose}:${value}`).digest('hex')
}

export function createVerification(secret: string) {
  const id = randomBytes(32).toString('hex')
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  return { id, code, codeHash: secretHash(secret, id, code) }
}

export async function checkTurnstile(token: string, config: { secret: string; hosts: string[] }, fetcher = fetch) {
  let response: Response
  try {
    response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: config.secret, response: token }), signal: AbortSignal.timeout(8000),
    })
  } catch { throw new SignupError('The security check is unavailable. Please try again.', 503) }
  if (!response.ok) throw new SignupError('The security check is unavailable. Please try again.', 503)
  const result = await response.json().catch(() => null)
  if (result?.success !== true || result.action !== 'signup' || !config.hosts.includes(result.hostname)) {
    throw new SignupError('Please complete the security check again.', 400)
  }
}

export async function sendVerificationEmail(email: string, code: string, id: string, config: { apiKey: string; from: string }, fetcher = fetch) {
  try {
    const response = await fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `signup/${id}` },
      body: JSON.stringify({
        from: config.from, to: [email], subject: 'Verify your BrightArk email',
        text: `Your BrightArk verification code is: ${code}\n\nEnter this code in the signup window. It expires in 15 minutes.\n\nIf you did not request an account, ignore this email.`,
      }),
      signal: AbortSignal.timeout(10000),
    })
    const result = await response.json().catch(() => null)
    if (!response.ok || typeof result?.id !== 'string') throw new Error('Email rejected')
  } catch { throw new SignupError('Unable to send the verification email. Please try again in a minute.', 503) }
}

export async function readSignupJson(request: Request) {
  if (!request.body) throw new SignupError('Invalid request')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > 16_384) {
      await reader.cancel()
      throw new SignupError('Request is too large', 413)
    }
    chunks.push(value)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown }
  catch { throw new SignupError('Invalid request') }
}
