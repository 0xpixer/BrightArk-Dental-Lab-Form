import assert from 'node:assert/strict'
import test from 'node:test'
import { canViewAccount, normalizeActorName } from './accountIdentity'

test('normalizes valid actor names and rejects missing or oversized names', () => {
  assert.deepEqual(normalizeActorName('  Lab Manager  '), { value: 'Lab Manager' })
  assert.equal(normalizeActorName(' ').error, 'Actor name is required')
  assert.match(normalizeActorName('x'.repeat(101)).error ?? '', /100 characters/)
})

test('only arrow7440 can view the hidden superadmin account', () => {
  assert.equal(canViewAccount('arrow7440', 'arrow7440'), true)
  assert.equal(canViewAccount('another-admin', 'arrow7440'), false)
  assert.equal(canViewAccount('another-admin', 'ordinary-user'), true)
})
