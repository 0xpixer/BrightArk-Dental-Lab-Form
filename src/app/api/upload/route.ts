import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const slotName = formData.get('slotName') as string
    const orderNo = formData.get('orderNo') as string

    if (!file || !slotName || !orderNo) {
      return NextResponse.json(
        { error: 'Missing file, slotName, or orderNo' },
        { status: 400 }
      )
    }

    // Sanitise filename: remove spaces and special chars
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const pathname = `orders/${orderNo}/${slotName}/${safeName}`

    const blob = await put(pathname, file, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    })

    return NextResponse.json({ url: blob.url, pathname: blob.pathname })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}

// Increase body size limit for file uploads (default 4MB is too small)
export const config = {
  api: {
    bodyParser: false,
  },
}
