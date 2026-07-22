import PDFDocument from 'pdfkit'
import type { Order } from '@/lib/db/schema'
import { formatDetailLines } from './formatOrderDetails'

function addSection(doc: InstanceType<typeof PDFDocument>, title: string, lines: string[]) {
  doc.fontSize(12).fillColor('#1E6DBF').text(title, { underline: true })
  doc.moveDown(0.3)
  doc.fontSize(10).fillColor('#1D1D1F')
  lines.forEach((line) => {
    if (line) doc.text(line)
  })
  doc.moveDown(0.8)
}

function addDownloadLink(doc: InstanceType<typeof PDFDocument>, label: string, url: string) {
  doc.fontSize(10).fillColor('#1D1D1F').text(`${label}: `, { continued: true })
  doc.fillColor('#1E6DBF').text('Download', { link: url, underline: true })
  doc.fillColor('#1D1D1F')
}

export function generateOrderPdfBuffer(order: Order, zipDownloadUrl?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk) => chunks.push(chunk as Buffer))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(20).fillColor('#F47B20').text('BrightArk Dental Lab', { align: 'center' })
    doc.fontSize(14).fillColor('#1D1D1F').text('Order Form Summary', { align: 'center' })
    doc.moveDown(1)

    addSection(doc, 'Order Information', [
      `Order No: ${order.orderNo}`,
      `Date Sent: ${order.dateSent ? new Date(order.dateSent).toLocaleString() : '—'}`,
      `Status: ${order.status}`,
      `Patient: ${order.patientName}`,
      `Patient Age: ${order.patientAge ?? '—'}`,
      order.patientDob ? `Patient DOB: ${order.patientDob}` : '',
      `Sex: ${order.sex ?? '—'}`,
    ])

    if (order.treatmentType) {
      const treatmentLines = formatDetailLines(order.treatmentData as Record<string, unknown> | null)
      addSection(doc, 'Treatment', [
        `Type: ${order.treatmentType}`,
        ...treatmentLines,
      ])
    }

    if (order.toothSelection) {
      addSection(
        doc,
        'Tooth Selection & Shade',
        formatDetailLines(order.toothSelection as Record<string, unknown> | null),
      )
    }

    if (order.instructions) {
      addSection(doc, 'Instructions', [order.instructions])
    }

    if (order.cloudDriveLink) {
      doc.fontSize(12).fillColor('#1E6DBF').text('Cloud Drive Files', { underline: true })
      doc.moveDown(0.3)
      addDownloadLink(doc, 'Cloud Drive', order.cloudDriveLink)
      doc.moveDown(0.8)
    }

    const fileUrls = order.fileUrls as Record<string, string> | null
    if (fileUrls && Object.keys(fileUrls).length > 0) {
      doc.fontSize(12).fillColor('#1E6DBF').text('Uploaded Files', { underline: true })
      doc.moveDown(0.3)
      if (zipDownloadUrl) {
        addDownloadLink(doc, 'All uploaded files', zipDownloadUrl)
      } else {
        doc.fontSize(10).fillColor('#1D1D1F').text('Download all uploaded files from the order portal.')
      }
      doc.moveDown(0.8)
    }

    doc.end()
  })
}
