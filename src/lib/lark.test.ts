import assert from 'node:assert/strict'
import test from 'node:test'
import { getLarkWebhookError, notifyLarkOfOrder, type LarkOrder } from './lark'

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
