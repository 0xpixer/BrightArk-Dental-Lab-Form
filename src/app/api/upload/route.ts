import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'

// POST is called TWICE by the client SDK:
//   1st call: client asks for a secure upload token  → we return it
//   2nd call: Vercel Blob notifies us upload finished → we confirm
// The actual file bytes travel directly from the browser to Vercel Blob,
// so they NEVER pass through this function — no 413 errors possible.
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,

      // Step 1 — before issuing the upload token, set permissions
      onBeforeGenerateToken: async (pathname) => {
        return {
          // Accept images and STL/OBJ/PLY files
          allowedContentTypes: [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'application/octet-stream', // .stl / .obj / .ply
            'model/stl',
            'application/sla',
          ],
          maximumSizeInBytes: 200 * 1024 * 1024, // 200 MB — plenty for STL files
          tokenPayload: JSON.stringify({ pathname }),
        }
      },

      // Step 2 — Vercel Blob calls back once upload is complete
      onUploadCompleted: async ({ blob }) => {
        console.log('Upload complete:', blob.url)
        // You can update the DB here if needed in the future
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    )
  }
}
