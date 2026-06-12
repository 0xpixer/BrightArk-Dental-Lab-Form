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

export function generateOrderPdfBuffer(order: Order): Promise<Buffer> {
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
      `Dentist: ${order.dentist}`,
      `Clinic: ${order.clinic}`,
      `Email: ${order.email}`,
      `Alt Email: ${order.altEmail ?? '—'}`,
      `Phone: ${order.phone ?? '—'}`,
      `Address: ${order.address}`,
      `Patient: ${order.patientName}`,
      `Patient Age: ${order.patientAge ?? '—'}`,
      order.patientDob ? `Patient DOB: ${order.patientDob}` : '',
      `Sex: ${order.sex ?? '—'}`,
      `Date Required: ${order.dateRequired}`,
      `Repair: ${order.isRepair ? 'Yes' : 'No'}`,
      `Redo: ${order.isRedo ? 'Yes' : 'No'}`,
      `Urgent: ${order.isUrgent ? 'Yes' : 'No'}`,
      order.oldOrderNo ? `Old Order No: ${order.oldOrderNo}` : '',
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
      addSection(doc, 'Cloud Drive Link', [order.cloudDriveLink])
    }

    const fileUrls = order.fileUrls as Record<string, string> | null
    if (fileUrls && Object.keys(fileUrls).length > 0) {
      addSection(
        doc,
        'Uploaded Files',
        Object.entries(fileUrls).map(([slot, url]) => `${slot}: ${url}`),
      )
    }

    doc.end()
  })
}
