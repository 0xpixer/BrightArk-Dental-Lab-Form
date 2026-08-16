import assert from 'node:assert/strict'
import test from 'node:test'
import { getLarkWebhookError } from './lark'

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
