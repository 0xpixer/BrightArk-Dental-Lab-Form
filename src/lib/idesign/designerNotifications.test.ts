import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDesignerNotification } from './designerNotifications'

const input = {
  caseId: 7,
  orderNo: 'IDA-20261110-AD0CB1',
  patientName: 'Aligner Patient',
  doctorName: 'Dr Test',
  clinic: 'Smile Clinic',
}

test('builds a new-order designer notification with key order details', () => {
  const notification = buildDesignerNotification('submitted', input)
  assert.equal(notification.type, 'designer_case_submitted')
  assert.equal(notification.title, 'New clear aligner order — IDA-20261110-AD0CB1')
  assert.equal(notification.dedupeKey, 'designer-case-submitted-7')
  for (const line of ['Order: IDA-20261110-AD0CB1', 'Doctor: Dr Test', 'Clinic: Smile Clinic', 'Patient: Aligner Patient']) {
    assert.ok(notification.body.includes(line), line)
  }
})

test('builds an approval designer notification deduped per plan', () => {
  const notification = buildDesignerNotification('approved', { ...input, planId: 42, planVersion: 2 })
  assert.equal(notification.type, 'designer_plan_approved')
  assert.match(notification.title, /Treatment plan V2 approved — IDA-20261110-AD0CB1/)
  assert.equal(notification.dedupeKey, 'designer-plan-approved-42')
})

test('falls back when doctor, clinic, or patient are missing', () => {
  const notification = buildDesignerNotification('submitted', { ...input, patientName: ' ', doctorName: null, clinic: null })
  assert.match(notification.body, /Doctor: Not assigned/)
  assert.match(notification.body, /Clinic: Not provided/)
  assert.match(notification.body, /Patient: Not provided/)
})
