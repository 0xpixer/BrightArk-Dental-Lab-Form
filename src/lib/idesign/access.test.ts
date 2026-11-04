import assert from 'node:assert/strict'
import test from 'node:test'
import { canManageIDesignSchedule } from './access'

test('allows admin and clinical roles to manage iDesign wear schedules', () => {
  for (const role of ['superadmin', 'admin', 'doctor', 'clinic_staff']) {
    assert.equal(canManageIDesignSchedule(role), true, `${role} should manage schedules`)
  }
  assert.equal(canManageIDesignSchedule('sales'), false)
})
