import assert from 'node:assert/strict'
import test from 'node:test'
import { parseNewOrderFileUrls, parseProductionFileUrls } from './orderFiles'

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

test('accepts only production-prefixed final files', () => {
  assert.deepEqual(parseProductionFileUrls({
    'production-file-456': 'https://example.public.blob.vercel-storage.com/final-crown.jpg',
  }), {
    'production-file-456': 'https://example.public.blob.vercel-storage.com/final-crown.jpg',
  })
  assert.equal(parseProductionFileUrls({
    'bulk-file-456': 'https://example.public.blob.vercel-storage.com/final-crown.jpg',
  }), null)
})
