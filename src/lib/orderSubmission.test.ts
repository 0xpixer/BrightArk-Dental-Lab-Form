import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultFormValues } from '../types/orderForm'
import { parseOrderSubmission } from './orderSubmission'

test('preserves completed upload URLs through order submission validation', () => {
  const fileUrls = {
    'bulk-file-1': 'https://example.public.blob.vercel-storage.com/case/model.stl',
  }
  const result = parseOrderSubmission({ ...defaultFormValues, file_urls: fileUrls })

  assert.equal(result.success, true)
  if (result.success) assert.deepEqual(result.fileUrls, fileUrls)
})

test('rejects malformed upload maps instead of silently dropping them', () => {
  const result = parseOrderSubmission({
    ...defaultFormValues,
    file_urls: { 'bulk-file-1': 'http://insecure.example.com/model.stl' },
  })

  assert.deepEqual(result, { success: false, reason: 'files' })
})
