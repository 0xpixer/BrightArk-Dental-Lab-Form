import assert from 'node:assert/strict'
import test from 'node:test'
import { and, eq } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { orders } from '@/lib/db/schema'
import { doctorOrderScope } from './orderScope'

const dialect = new PgDialect()

test('Doctor and Sales scopes use only assigned owner IDs, never editable email or clinic fields', () => {
  for (const doctorIds of [[5], [5, 6]]) {
    const query = dialect.sqlToQuery(doctorOrderScope(doctorIds))
    assert.deepEqual(query.params, doctorIds)
    assert.match(query.sql, /"orders"\."submitted_by" in \(/)
    assert.doesNotMatch(query.sql, /email|clinic|is null|\bor\b/i)
  }
})

test('an empty or invalid doctor scope denies all access', () => {
  for (const ids of [[], [0], [-1], [NaN], [5, 0]]) {
    const query = dialect.sqlToQuery(doctorOrderScope(ids))
    assert.equal(query.sql, 'false')
    assert.deepEqual(query.params, [])
  }
})

test('requesting another order ID does not replace the owner restriction', () => {
  const query = dialect.sqlToQuery(and(eq(orders.id, 123), doctorOrderScope([5]))!)
  assert.deepEqual(query.params, [123, 5])
  assert.match(query.sql, /"orders"\."id" = \$1 and "orders"\."submitted_by" in \(\$2\)/)
})
