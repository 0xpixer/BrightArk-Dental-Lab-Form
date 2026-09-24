import assert from 'node:assert/strict'
import test from 'node:test'
import type { HandleUploadBody } from '@vercel/blob/client'
import { getUploadPathname, getUploadStoreToken } from './storeToken'

const environment = {
  BLOB_READ_WRITE_TOKEN: 'dental-token',
  UPLOADS_READ_WRITE_TOKEN: 'idesign-token',
}

test('routes dental uploads to the original dental store', () => {
  const body = tokenRequest('orders/2026092401/bulk-file-1/photo.png')
  assert.equal(getUploadPathname(body), 'orders/2026092401/bulk-file-1/photo.png')
  assert.equal(getUploadStoreToken(body, environment), 'dental-token')
})

test('routes iDesign uploads and completion callbacks to the aligner store', () => {
  assert.equal(getUploadStoreToken(tokenRequest('idesign/draft-1/upper-model/model.stl'), environment), 'idesign-token')
  assert.equal(getUploadStoreToken(completion('idesign/draft-1/upper-model/model.stl'), environment), 'idesign-token')
})

test('falls back to the available token when only one store is configured', () => {
  assert.equal(getUploadStoreToken(tokenRequest('orders/1/file.png'), { UPLOADS_READ_WRITE_TOKEN: 'shared-token' }), 'shared-token')
  assert.equal(getUploadStoreToken(tokenRequest('idesign/1/file.stl'), { BLOB_READ_WRITE_TOKEN: 'shared-token' }), 'shared-token')
})

function tokenRequest(pathname: string): HandleUploadBody {
  return { type: 'blob.generate-client-token', payload: { pathname, multipart: false, clientPayload: null } }
}

function completion(pathname: string): HandleUploadBody {
  return {
    type: 'blob.upload-completed',
    payload: {
      blob: {
        url: `https://example.public.blob.vercel-storage.com/${pathname}`,
        downloadUrl: `https://example.public.blob.vercel-storage.com/${pathname}?download=1`,
        pathname,
        contentType: 'application/octet-stream',
        contentDisposition: `attachment; filename="${pathname.split('/').pop()}"`,
        etag: 'test-etag',
      },
      tokenPayload: null,
    },
  }
}
