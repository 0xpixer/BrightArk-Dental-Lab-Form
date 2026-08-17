import assert from 'node:assert/strict'
import test from 'node:test'
import { getMessageAuthor, MAX_ORDER_MESSAGE_LENGTH, parseOrderMessage } from './orderMessages'

test('maps account roles to conversation identities', () => {
  assert.equal(getMessageAuthor('doctor'), 'Doctor')
  assert.equal(getMessageAuthor('clinic_staff'), 'Doctor')
  assert.equal(getMessageAuthor('admin'), 'Lab')
  assert.equal(getMessageAuthor('superadmin'), 'Admin')
  assert.equal(getMessageAuthor('unknown'), null)
})

test('normalizes valid messages and rejects empty or oversized content', () => {
  assert.equal(parseOrderMessage('  Please check the margin.  '), 'Please check the margin.')
  assert.equal(parseOrderMessage('   '), null)
  assert.equal(parseOrderMessage('x'.repeat(MAX_ORDER_MESSAGE_LENGTH + 1)), null)
})
