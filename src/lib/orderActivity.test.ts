import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeOrderNote, ORDER_NOTE_MAX_LENGTH } from './orderActivity'

test('normalizes short order notes', () => {
  assert.deepEqual(normalizeOrderNote('  Check contact  '), { value: 'Check contact' })
  assert.deepEqual(normalizeOrderNote('   '), { value: null })
})

test('rejects invalid and oversized order notes', () => {
  assert.equal(normalizeOrderNote(42).error, 'Note must be text')
  assert.ok(normalizeOrderNote('x'.repeat(ORDER_NOTE_MAX_LENGTH + 1)).error)
})
