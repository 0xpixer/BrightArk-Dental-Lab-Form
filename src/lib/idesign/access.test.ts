import assert from 'node:assert/strict'
import test from 'node:test'
import { PgDialect } from 'drizzle-orm/pg-core'
import { canViewIDesign, getIDesignAccessCondition } from './access'

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

test('only Superadmin receives an unrestricted iDesign scope', async () => {
  assert.equal(await getIDesignAccessCondition(1, 'superadmin'), undefined)
  for (const role of ['admin', 'unknown', '']) {
    assert.equal(canViewIDesign(role), false)
    assert.equal(dialect.sqlToQuery((await getIDesignAccessCondition(4, role))!).sql, 'false')
  }
})
