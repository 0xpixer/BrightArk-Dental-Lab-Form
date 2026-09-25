import assert from 'node:assert/strict'
import test from 'node:test'
import { checkTurnstile, createVerification, emailLimitIdentity, readSignupJson, registrationSchema, requestIp, secretHash, sendVerificationEmail, signupConfig, SignupError } from './security'

test('Turnstile requires success, the signup action, and an allowed hostname', async () => {
  const config = { secret: 'local-test', hosts: ['brightark.example.test'] }
  const valid = { success: true, action: 'signup', hostname: config.hosts[0] }
  await checkTurnstile('token', config, async (url, init) => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify')
    assert.deepEqual(JSON.parse(String(init?.body)), { secret: config.secret, response: 'token' })
    assert.ok(init?.signal)
    return Response.json(valid)
  })
  for (const body of [null, {}, { ...valid, success: false }, { ...valid, hostname: 'attacker.test' }, { ...valid, action: 'login' }]) {
    await assert.rejects(checkTurnstile('token', config, async () => Response.json(body)), SignupError)
  }
  await assert.rejects(checkTurnstile('token', config, async () => new Response('bad', { status: 503 })), { status: 503 })
  await assert.rejects(checkTurnstile('token', config, async () => { throw new Error('timeout') }), { status: 503 })
})

test('Turnstile supports a distinct password reset action', async () => {
  const config = { secret: 'local-test', hosts: ['brightark.example.test'] }
  await checkTurnstile('token', config, async () => Response.json({
    success: true,
    action: 'password-reset',
    hostname: config.hosts[0],
  }), 'password-reset')
  await assert.rejects(checkTurnstile('token', config, async () => Response.json({
    success: true,
    action: 'signup',
    hostname: config.hosts[0],
  }), 'password-reset'), SignupError)
})

test('registration validates bounded input, strips roles, and requires a captcha token', () => {
  const body = { email: ' Doctor@Example.test ', password: '12345678', fullName: 'Doctor', clinicName: 'Clinic', turnstileToken: 'test', role: 'superadmin', isActive: true }
  const parsed = registrationSchema.parse(body)
  assert.equal(parsed.email, 'doctor@example.test')
  assert.equal('role' in parsed, false)
  assert.equal('isActive' in parsed, false)
  for (const override of [{ turnstileToken: '' }, { password: 'short' }, { password: 'x'.repeat(73) }, { fullName: 'x'.repeat(151) }, { email: 'not-email' }]) {
    assert.equal(registrationSchema.safeParse({ ...body, ...override }).success, false)
  }
})

test('codes are random, hashed with a server secret, and tied to their registration', () => {
  const a = createVerification('test-secret')
  const b = createVerification('test-secret')
  assert.match(a.id, /^[a-f0-9]{64}$/)
  assert.match(a.code, /^\d{6}$/)
  assert.notEqual(a.id, b.id)
  assert.equal(a.codeHash, secretHash('test-secret', a.id, a.code))
  assert.notEqual(a.codeHash, secretHash('test-secret', b.id, a.code))
  assert.notEqual(a.codeHash, secretHash('other-secret', a.id, a.code))
})

test('quota identifiers group Gmail dot and plus aliases without changing other domains', () => {
  assert.equal(emailLimitIdentity('D.octor+spam@gmail.com'), 'doctor@gmail.com')
  assert.equal(emailLimitIdentity('doctor@googlemail.com'), 'doctor@gmail.com')
  assert.equal(emailLimitIdentity('D.octor@clinic.test'), 'd.octor@clinic.test')
})

test('untrusted forwarding headers cannot choose rate limit identities outside Vercel', () => {
  const request = new Request('https://example.test', { headers: { 'x-forwarded-for': '198.51.100.2', 'x-vercel-forwarded-for': '198.51.100.1' } })
  assert.equal(requestIp(request, false), 'unknown')
  assert.equal(requestIp(request, true), '198.51.100.1')
  assert.equal(requestIp(new Request('https://example.test'), true), 'unknown')
})

test('email sends only the code, with bounded timeout and idempotency, and rejects provider failures', async () => {
  const config = { apiKey: 'test-key', from: 'BrightArk <verify@example.test>' }
  await sendVerificationEmail('doctor@example.test', '012345', 'test-id', config, async (_url, init) => {
    const payload = JSON.parse(String(init?.body))
    assert.equal(payload.from, config.from)
    assert.deepEqual(payload.to, ['doctor@example.test'])
    assert.match(payload.text, /012345/)
    assert.match(payload.text, /15 minutes/)
    assert.equal(new Headers(init?.headers).get('Idempotency-Key'), 'signup/test-id')
    return Response.json({ id: 'sent' })
  })
  for (const response of [Response.json({ error: 'rejected' }, { status: 403 }), new Response('bad'), Response.json({})]) {
    await assert.rejects(sendVerificationEmail('doctor@example.test', '012345', 'test-id', config, async () => response), { status: 503 })
  }
})

test('oversized and malformed payloads are rejected before parsing or password hashing', async () => {
  const request = (body: string) => new Request('https://example.test', { method: 'POST', body })
  assert.deepEqual(await readSignupJson(request('{"email":"test"}')), { email: 'test' })
  await assert.rejects(readSignupJson(request('invalid')), { status: 400 })
  await assert.rejects(readSignupJson(request('x'.repeat(20_000))), { status: 413 })
})

test('missing signup configuration fails closed', () => {
  const old = process.env.TURNSTILE_SECRET_KEY
  delete process.env.TURNSTILE_SECRET_KEY
  try { assert.throws(() => signupConfig(), { status: 503 }) }
  finally { if (old !== undefined) process.env.TURNSTILE_SECRET_KEY = old }
})
