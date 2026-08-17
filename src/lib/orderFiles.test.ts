import assert from 'node:assert/strict'
import test from 'node:test'
import { parseNewOrderFileUrls } from './orderFiles'

test('accepts append-only HTTPS bulk file entries', () => {
  assert.deepEqual(parseNewOrderFileUrls({
    'bulk-file-123': 'https://example.public.blob.vercel-storage.com/case.zip',
  }), {
    'bulk-file-123': 'https://example.public.blob.vercel-storage.com/case.zip',
  })
})

test('rejects invalid slots and non-HTTPS URLs', () => {
  assert.equal(parseNewOrderFileUrls({ 'upper-model': 'https://example.com/model.stl' }), null)
  assert.equal(parseNewOrderFileUrls({ 'bulk-file-123': 'http://example.com/model.stl' }), null)
  assert.equal(parseNewOrderFileUrls({}), null)
})
