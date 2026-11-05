import assert from 'node:assert/strict'
import test from 'node:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import { canAssignIDesignOrders, canManageIDesignSchedule, canViewIDesign, getIDesignAccessCondition, getIDesignCaseAccessCondition } from './access'

const dialect = new PgDialect()

test('iDesign Sales and Doctors are restricted to their separately assigned orders', async () => {
  for (const [role, column] of [['sales', 'sales_account_id'], ['doctor', 'doctor_account_id']]) {
    const condition = await getIDesignAccessCondition(4, role)
    assert.ok(condition)
    const query = dialect.sqlToQuery(condition)
    assert.equal(query.sql, `"idesign_orders"."${column}" = $1`)
    assert.deepEqual(query.params, [4])
  }
})

test('Superadmin and Lab Admin receive an unrestricted iDesign scope', async () => {
  assert.equal(await getIDesignAccessCondition(1, 'superadmin'), undefined)
  assert.equal(await getIDesignAccessCondition(2, 'admin'), undefined)
  assert.equal(canViewIDesign('admin'), true)
  for (const role of ['unknown', '']) {
    assert.equal(canViewIDesign(role), false)
    assert.equal(dialect.sqlToQuery((await getIDesignAccessCondition(4, role))!).sql, 'false')
  }
})

test('new clinical cases use the same Doctor and Sales ownership rules', async () => {
  for (const [role, column] of [['sales', 'sales_account_id'], ['doctor', 'doctor_account_id']]) {
    const condition = await getIDesignCaseAccessCondition(7, role)
    assert.ok(condition)
    const query = dialect.sqlToQuery(condition)
    assert.equal(query.sql, `"idesign_cases"."${column}" = $1`)
    assert.deepEqual(query.params, [7])
  }
  assert.equal(await getIDesignCaseAccessCondition(1, 'superadmin'), undefined)
})

test('allows admin and clinical roles to manage iDesign wear schedules', () => {
  for (const role of ['superadmin', 'admin', 'doctor', 'clinic_staff']) {
    assert.equal(canManageIDesignSchedule(role), true, `${role} should manage schedules`)
  }
  assert.equal(canManageIDesignSchedule('sales'), false)
})

test('allows only Superadmin and Lab Admin to assign iDesign order access', () => {
  assert.equal(canAssignIDesignOrders('superadmin'), true)
  assert.equal(canAssignIDesignOrders('admin'), true)
  for (const role of ['sales', 'doctor', 'clinic_staff']) {
    assert.equal(canAssignIDesignOrders(role), false)
  }
})
