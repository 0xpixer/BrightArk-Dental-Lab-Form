import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/octet-stream',
  'model/stl',
]

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith('orders/')) {
          throw new Error('Invalid upload path')
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: 100 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ pathname }),
        }
      },
      onUploadCompleted: async ({ blob }) => {
        console.log('Blob upload completed:', blob.url)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 400 },
    )
  }
}
