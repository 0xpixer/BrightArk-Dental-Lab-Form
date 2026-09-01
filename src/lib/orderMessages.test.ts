import assert from 'node:assert/strict'
import test from 'node:test'
import { getMessageAuthor, MAX_ORDER_MESSAGE_LENGTH, parseOrderMessage, parseOrderMessagePayload } from './orderMessages'

test('maps account roles to conversation identities', () => {
  assert.equal(getMessageAuthor('doctor'), 'Doctor')
  assert.equal(getMessageAuthor('clinic_staff'), 'Doctor')
  assert.equal(getMessageAuthor('sales'), 'Sales')
  assert.equal(getMessageAuthor('admin'), 'Lab')
  assert.equal(getMessageAuthor('superadmin'), 'Admin')
  assert.equal(getMessageAuthor('unknown'), null)
})

test('normalizes valid messages and rejects empty or oversized content', () => {
  assert.equal(parseOrderMessage('  Please check the margin.  '), 'Please check the margin.')
  assert.equal(parseOrderMessage('   '), null)
  assert.equal(parseOrderMessage('x'.repeat(MAX_ORDER_MESSAGE_LENGTH + 1)), null)
})

test('accepts text, image, or combined message payloads', () => {
  assert.deepEqual(parseOrderMessagePayload({ message: '  Looks good  ' }), {
    message: 'Looks good', imageUrl: null, imageName: null,
  })
  assert.deepEqual(parseOrderMessagePayload({
    message: '',
    imageUrl: 'https://store.public.blob.vercel-storage.com/orders/1/messages/result.jpg',
    imageName: 'result.jpg',
  }), {
    message: null,
    imageUrl: 'https://store.public.blob.vercel-storage.com/orders/1/messages/result.jpg',
    imageName: 'result.jpg',
  })
})

test('rejects external, non-image, empty, and oversized message payloads', () => {
  assert.equal(parseOrderMessagePayload({}), null)
  assert.equal(parseOrderMessagePayload({ message: 'x'.repeat(MAX_ORDER_MESSAGE_LENGTH + 1), imageUrl: 'https://store.public.blob.vercel-storage.com/a.jpg', imageName: 'a.jpg' }), null)
  assert.equal(parseOrderMessagePayload({ imageUrl: 'https://example.com/a.jpg', imageName: 'a.jpg' }), null)
  assert.equal(parseOrderMessagePayload({ imageUrl: 'https://store.public.blob.vercel-storage.com/orders/1/uploads/a.jpg', imageName: 'a.jpg' }), null)
  assert.equal(parseOrderMessagePayload({ imageUrl: 'https://store.public.blob.vercel-storage.com/a.pdf', imageName: 'a.pdf' }), null)
})
