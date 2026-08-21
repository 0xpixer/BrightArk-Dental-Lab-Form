import assert from 'node:assert/strict'
import test from 'node:test'
import JSZip from 'jszip'
import { generateSubmissionsWorkbook } from './generateSubmissionsWorkbook'

test('generates an xlsx workbook with the requested columns in order', async () => {
  const buffer = await generateSubmissionsWorkbook([{
    patientName: 'Jane & John', orderNo: '2026082101', statusUpdatedAt: '21/08/2026',
    submittedAt: '20/08/2026', dentist: 'Dr Smith', status: 'Lab Designing',
  }])
  const zip = await JSZip.loadAsync(buffer)
  const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
  const headerPositions = ['Patient name', 'Order ID', 'Update time', 'Submit time', 'Doctor name', 'Status'].map((header) => sheet.indexOf(header))
  assert.ok(headerPositions.every((position, index) => position >= 0 && (index === 0 || position > headerPositions[index - 1])))
  assert.match(sheet, /Jane &amp; John/)
})
