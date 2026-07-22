import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'

// This route only handles the TOKEN HANDSHAKE (tiny JSON payloads).
// The actual file bytes travel directly from the browser to Vercel Blob
// using the token — they NEVER pass through this function.
// Result: no 413, no CORS, works for files up to 500MB.
export async function POST(request: Request): Promise<NextResponse> {
  let body: HandleUploadBody

  try {
    body = (await request.json()) as HandleUploadBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,

      onBeforeGenerateToken: async (pathname) => {
        // No auth check needed here — the form is public-facing.
        // Add session validation here in the future if required.
        return {
          // Accept photos, PDFs, compressed case packages, and binary scan files.
          allowedContentTypes: [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'application/pdf',
            'application/zip',
            'application/x-zip-compressed',
            'application/x-rar-compressed',
            'application/vnd.rar',
            'application/x-7z-compressed',
            'application/gzip',
            'application/x-gzip',
            'application/x-tar',
            'application/octet-stream', // .stl .obj .ply
            'model/stl',
            'application/sla',
            'application/vnd.ms-pki.stl',
          ],
          maximumSizeInBytes: 500 * 1024 * 1024, // 500 MB
          addRandomSuffix: false,                 // keep our organised folder path
        }
      },

      onUploadCompleted: async ({ blob }) => {
        // Vercel Blob calls this webhook once the upload finishes.
        // You can update the DB here in the future if needed.
        console.log('Upload completed:', blob.url)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error('handleUpload error:', error)
    return NextResponse.json(
      { error: (error as Error).message ?? 'Upload failed' },
      { status: 400 }
    )
  }
}
