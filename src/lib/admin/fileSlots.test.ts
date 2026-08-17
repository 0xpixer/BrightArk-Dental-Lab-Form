import assert from 'node:assert/strict'
import test from 'node:test'
import { getFilenameFromUrl } from './fileSlots'

test('extracts a safe original filename from a blob URL', () => {
  assert.equal(
    getFilenameFromUrl('https://example.public.blob.vercel-storage.com/orders/1/bulk-file-1/Patient%20Photo.jpg'),
    'Patient_Photo.jpg',
  )
})

test('rejects invalid URLs and path-like filenames', () => {
  assert.equal(getFilenameFromUrl('not-a-url'), null)
  assert.equal(getFilenameFromUrl('https://example.com/%2E%2E'), null)
})
