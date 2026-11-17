import assert from 'node:assert/strict'
import test from 'node:test'
import { labNewOrderEmail, labOrderPath, labStatusEmail } from './labOrderEmailContent'

const order = { id: 42, orderNo: 'BA-1117-01', patientName: 'Wulan Sari', clinic: 'Sea & Star', treatmentType: 'Fixed Prosthesis' }

test('status email names the new status and links to the order', () => {
  const email = labStatusEmail(order, 'shipped', 'https://order.thebrightark.com/portal/orders/42')
  assert.equal(email.subject, 'Dental lab order BA-1117-01 is now Shipped')
  assert.match(email.text, /on its way/)
  assert.match(email.text, /Patient: Wulan Sari/)
  assert.match(email.text, /Open order: https:\/\/order\.thebrightark\.com\/portal\/orders\/42/)
})

test('new order email includes the doctor and skips a missing link', () => {
  const email = labNewOrderEmail({ ...order, clinic: null }, 'Dr Pua', null)
  assert.equal(email.subject, 'New dental lab order — BA-1117-01')
  assert.match(email.text, /submitted by Dr Pua/)
  assert.doesNotMatch(email.text, /Clinic:|Open order/)
})

test('doctors and clinic staff open the portal, everyone else the dashboard', () => {
  assert.equal(labOrderPath('doctor', 42), '/portal/orders/42')
  assert.equal(labOrderPath('clinic_staff', 42), '/portal/orders/42')
  assert.equal(labOrderPath('sales', 42), '/admin/submissions/42')
  assert.equal(labOrderPath('admin', 42), '/admin/submissions/42')
})
