import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'

// Edge runtime is the key:
//   - No 4.5MB body size limit (unlike serverless functions)
//   - Streams the file directly to Vercel Blob without buffering
//   - No CORS issues — browser talks to YOUR domain, not blob.vercel-storage.com
export const runtime = 'edge'

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const filename = searchParams.get('filename')

  if (!filename) {
    return NextResponse.json({ error: 'Missing filename param' }, { status: 400 })
  }

  if (!request.body) {
    return NextResponse.json({ error: 'Missing file body' }, { status: 400 })
  }

  try {
    const blob = await put(filename, request.body, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: (error as Error).message ?? 'Upload failed' },
      { status: 500 }
    )
  }
}
