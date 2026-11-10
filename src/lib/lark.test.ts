import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import { getLarkWebhookError, notifyLarkOfAlignerCase, signLarkWebhook, notifyLarkOfOrder, type LarkOrder } from './lark'

test('accepts current and legacy Lark webhook success responses', () => {
  assert.equal(getLarkWebhookError({ code: 0, msg: 'success' }), null)
  assert.equal(getLarkWebhookError({ StatusCode: 0, StatusMessage: 'success' }), null)
})

test('returns the Lark error message for rejected webhook requests', () => {
  assert.equal(getLarkWebhookError({ code: 19024, msg: 'Key Words Not Found' }), 'Key Words Not Found (code 19024)')
  assert.equal(getLarkWebhookError({ StatusCode: 9499, StatusMessage: 'Bad Request' }), 'Bad Request (code 9499)')
})

test('rejects an unrecognized success-shaped response', () => {
  assert.equal(getLarkWebhookError({ ok: true }), 'Unrecognized Lark webhook response')
})

const order: LarkOrder = {
  id: 42,
  orderNo: '2026091701',
  patientName: 'Test Patient',
  clinic: 'Test Clinic',
  treatmentType: null,
  createdAt: new Date('2026-09-17T01:00:00Z'),
}

function deliveryOptions(fetcher: typeof fetch) {
  const delivered: number[] = []
  const errors: string[] = []
  return {
    delivered,
    errors,
    options: {
      webhookUrl: 'https://lark.example.test/webhook',
      appUrl: 'https://brightark.example.test/',
      fetcher,
      recordDelivery: async (id: number) => { delivered.push(id) },
      reportError: (message: string) => { errors.push(message) },
    },
  }
}

test('sends the new order once with an absolute case link and records the acknowledgement', async () => {
  let calls = 0
  const { options, delivered, errors } = deliveryOptions(async (url, init) => {
    calls += 1
    assert.equal(url, 'https://lark.example.test/webhook')
    assert.equal(init?.method, 'POST')
    assert.ok(init?.signal instanceof AbortSignal)
    const payload = JSON.parse(String(init?.body))
    assert.equal(payload.msg_type, 'text')
    assert.match(payload.content.text, /Order: 2026091701/)
    assert.match(payload.content.text, /Patient: Test Patient/)
    assert.match(payload.content.text, /Treatment: Not selected/)
    assert.match(payload.content.text, /https:\/\/brightark.example.test\/admin\/submissions\/42/)
    assert.equal(delivered.length, 0)
    return Response.json({ code: 0 })
  })
  assert.equal(await notifyLarkOfOrder(order, options), true)
  assert.equal(calls, 1)
  assert.deepEqual(delivered, [42])
  assert.deepEqual(errors, [])
})

test('shows a clear fallback when the optional patient name is blank', async () => {
  const { options } = deliveryOptions(async (_url, init) => {
    const payload = JSON.parse(String(init?.body))
    assert.match(payload.content.text, /Patient: Not provided/)
    return Response.json({ code: 0 })
  })
  assert.equal(await notifyLarkOfOrder({ ...order, patientName: '  ' }, options), true)
})

test('HTTP errors, Lark rejections, and invalid responses are logged without marking delivery or retrying', async () => {
  for (const response of [
    new Response('Unavailable', { status: 503 }),
    Response.json({ code: 19024, msg: 'Key Words Not Found' }),
    new Response('not JSON'),
    Response.json({ ok: true }),
  ]) {
    let calls = 0
    const { options, delivered, errors } = deliveryOptions(async () => { calls += 1; return response })
    assert.equal(await notifyLarkOfOrder(order, options), false)
    assert.equal(calls, 1)
    assert.deepEqual(delivered, [])
    assert.equal(errors.length, 1)
    assert.match(errors[0], /Lark notification failed for order 2026091701/)
  }
})

test('missing webhook configuration makes no network request and reports the failure', async () => {
  const { options, delivered, errors } = deliveryOptions(async () => { assert.fail('Unexpected request') })
  assert.equal(await notifyLarkOfOrder(order, { ...options, webhookUrl: undefined }), false)
  assert.deepEqual(delivered, [])
  assert.match(errors[0], /LARK_WEBHOOK_URL is not configured/)
})

test('network errors and timeouts settle the background task without throwing', async () => {
  for (const error of [new Error('fetch failed'), new DOMException('Timed out', 'TimeoutError')]) {
    const { options, delivered, errors } = deliveryOptions(async () => { throw error })
    assert.equal(await notifyLarkOfOrder(order, options), false)
    assert.deepEqual(delivered, [])
    assert.equal(errors.length, 1)
  }
})

test('a delivery-record failure is logged without resending an acknowledged message', async () => {
  let calls = 0
  const { options, errors } = deliveryOptions(async () => { calls += 1; return Response.json({ StatusCode: 0 }) })
  assert.equal(await notifyLarkOfOrder(order, {
    ...options,
    recordDelivery: async () => { throw new Error('Database unavailable') },
  }), false)
  assert.equal(calls, 1)
  assert.match(errors[0], /Database unavailable/)
})

const alignerCase = {
  id: 7,
  orderNo: 'IDS-0001',
  patientName: 'Aligner Patient',
  doctorName: 'Dr Test',
  clinic: 'Smile Clinic',
  planVersion: 2,
}

test('sends clear aligner submission and approval messages with the order link', async () => {
  for (const event of ['submitted', 'approved'] as const) {
    const texts: string[] = []
    const sent = await notifyLarkOfAlignerCase(event, alignerCase, {
      webhookUrl: 'https://lark.example.test/aligner',
      appUrl: 'https://brightark.example.test/',
      occurredAt: new Date('2026-09-17T01:00:00Z'),
      fetcher: async (url, init) => {
        assert.equal(url, 'https://lark.example.test/aligner')
        texts.push(JSON.parse(String(init?.body)).content.text)
        return Response.json({ code: 0 })
      },
    })
    assert.equal(sent, true)
    const [text] = texts
    assert.match(text, event === 'submitted' ? /order submitted/ : /plan approved/)
    assert.match(text, /Order: IDS-0001 \(ID 7\)/)
    assert.match(text, /Doctor: Dr Test/)
    assert.match(text, /Clinic: Smile Clinic/)
    assert.match(text, /Patient: Aligner Patient/)
    assert.match(text, event === 'approved' ? /Approved: / : /Submitted: /)
    assert.equal(/Plan: V2/.test(text), event === 'approved')
    assert.match(text, /https:\/\/brightark.example.test\/admin\/idesign\/orders\/7/)
  }
})

test('aligner notification skips silently without a webhook and swallows failures', async () => {
  const errors: string[] = []
  assert.equal(await notifyLarkOfAlignerCase('submitted', alignerCase, {
    webhookUrl: undefined,
    appUrl: 'https://x.test',
    fetcher: async () => assert.fail('Unexpected request'),
    reportError: (message) => { errors.push(message) },
  }), false)
  assert.equal(errors.length, 0)
  assert.equal(await notifyLarkOfAlignerCase('approved', alignerCase, {
    webhookUrl: 'https://lark.example.test/aligner',
    appUrl: 'https://x.test',
    fetcher: async () => { throw new Error('fetch failed') },
    reportError: (message) => { errors.push(message) },
  }), false)
  assert.match(errors[0], /Lark aligner approved notification failed for order IDS-0001/)
})

test('signs aligner messages when a secret is configured', async () => {
  let body: Record<string, unknown> = {}
  assert.equal(await notifyLarkOfAlignerCase('submitted', alignerCase, {
    webhookUrl: 'https://lark.example.test/aligner',
    secret: 'test-secret',
    appUrl: 'https://x.test',
    fetcher: async (_url, init) => { body = JSON.parse(String(init?.body)); return Response.json({ code: 0 }) },
  }), true)
  const timestamp = Number(body.timestamp)
  assert.ok(Math.abs(timestamp - Date.now() / 1000) < 5)
  assert.equal(body.sign, signLarkWebhook('test-secret', timestamp))
  // Known-answer check against Lark's documented algorithm (HMAC key = "timestamp\nsecret", empty message).
  assert.equal(signLarkWebhook('test-secret', 1599360473), createHmac('sha256', '1599360473\ntest-secret').update('').digest('base64'))
})
