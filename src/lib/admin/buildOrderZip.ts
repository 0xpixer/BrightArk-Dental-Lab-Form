import JSZip from 'jszip'
import type { Order } from '@/lib/db/schema'
import { generateOrderPdfBuffer } from './generateOrderPdf'
import { SLOT_FOLDER_MAP, getExtensionFromUrl } from './fileSlots'

export async function buildOrderZip(order: Order, zipDownloadUrl?: string): Promise<Buffer> {
  const zip = new JSZip()
  const pdfBuffer = await generateOrderPdfBuffer(order, zipDownloadUrl)
  zip.file(`order_${order.orderNo}_form.pdf`, pdfBuffer)

  const fileUrls = (order.fileUrls as Record<string, string> | null) ?? {}

  await Promise.all(
    Object.entries(fileUrls).map(async ([slotId, url]) => {
      if (!url) return
      try {
        const res = await fetch(url)
        if (!res.ok) return
        const buffer = Buffer.from(await res.arrayBuffer())
        const mapping = SLOT_FOLDER_MAP[slotId]
        const ext = getExtensionFromUrl(url)
        const path = mapping
          ? `${mapping.folder}/${mapping.filename}.${ext}`
          : `other/${slotId}.${ext}`
        zip.file(path, buffer)
      } catch (err) {
        console.error(`Failed to fetch file for slot ${slotId}:`, err)
      }
    }),
  )

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
