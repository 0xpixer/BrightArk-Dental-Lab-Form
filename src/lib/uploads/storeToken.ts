import type { HandleUploadBody } from '@vercel/blob/client'

interface UploadStoreEnvironment {
  BLOB_READ_WRITE_TOKEN?: string
  UPLOADS_READ_WRITE_TOKEN?: string
}

export function getUploadPathname(body: HandleUploadBody) {
  return body.type === 'blob.generate-client-token'
    ? body.payload.pathname
    : body.payload.blob.pathname
}

export function getUploadStoreToken(body: HandleUploadBody, environment: UploadStoreEnvironment = {
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN,
  UPLOADS_READ_WRITE_TOKEN: process.env.UPLOADS_READ_WRITE_TOKEN,
}) {
  const pathname = getUploadPathname(body)
  const isIDesignUpload = pathname === 'idesign' || pathname.startsWith('idesign/')

  return isIDesignUpload
    ? environment.UPLOADS_READ_WRITE_TOKEN || environment.BLOB_READ_WRITE_TOKEN
    : environment.BLOB_READ_WRITE_TOKEN || environment.UPLOADS_READ_WRITE_TOKEN
}
