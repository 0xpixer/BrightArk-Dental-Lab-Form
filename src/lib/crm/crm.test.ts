import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCrmAccess, canAccessCrmOwner, canChooseCrmOwner, canViewCrm, crmCreateSchema, crmFieldAccess,
  crmPatchSchema, followUpState, lockedFieldsInPatch, normalizeCrmEmail, sumByCurrency,
} from './crm'

test('only Superadmin, Sales Directors and Sales can see the CRM', () => {
  for (const role of ['superadmin', 'sales_director', 'sales']) assert.equal(canViewCrm(role), true, role)
  for (const role of ['admin', 'doctor', 'clinic_staff', 'treatment_designer', '']) assert.equal(canViewCrm(role), false, role)
  assert.equal(buildCrmAccess(1, 'admin', [1]), null)
})

test('scope: superadmin sees all, a director sees their reps, a rep sees only themselves', () => {
  const superadmin = buildCrmAccess(1, 'superadmin', [])!
  assert.equal(superadmin.all, true)
  assert.equal(canAccessCrmOwner(superadmin, 999), true)

  const director = buildCrmAccess(10, 'sales_director', [10, 11, 12])!
  assert.deepEqual(director.salesIds.sort(), [10, 11, 12])
  assert.equal(canAccessCrmOwner(director, 11), true)
  assert.equal(canAccessCrmOwner(director, 13), false)
  assert.equal(canChooseCrmOwner(director), true)

  // Even if the assignment table lists reps under a plain Sales account, it only sees its own.
  const rep = buildCrmAccess(11, 'sales', [11, 12])!
  assert.deepEqual(rep.salesIds, [11])
  assert.equal(canAccessCrmOwner(rep, 12), false)
  assert.equal(canChooseCrmOwner(rep), false)
})

test('sync policy: mirrored fields lock only while the owner is assigned to the linked doctor', () => {
  assert.deepEqual(crmFieldAccess({ doctorAccountId: null, assigned: false }), { locked: [], writeThrough: [] })
  assert.deepEqual(crmFieldAccess({ doctorAccountId: 5, assigned: false }), { locked: ['email'], writeThrough: [] })
  const linked = crmFieldAccess({ doctorAccountId: 5, assigned: true })
  assert.deepEqual(linked.writeThrough, ['phone', 'country', 'city'])
  assert.deepEqual(lockedFieldsInPatch({ fullName: 'X', phone: '1', status: 'active' }, linked), ['fullName'])
  assert.deepEqual(lockedFieldsInPatch({ salesId: 3 }, linked), ['salesId'])
  assert.deepEqual(lockedFieldsInPatch({ notes: 'n', tags: [], nextFollowUp: null, specialty: 'Ortho' }, linked), [])
})

test('input validation normalises emails, tags and dates', () => {
  assert.equal(normalizeCrmEmail('  Dr.Who@Example.COM '), 'dr.who@example.com')
  assert.equal(normalizeCrmEmail('   '), null)
  const created = crmCreateSchema.parse({ fullName: ' Dr A ', email: 'A@B.co', tags: 'vip, ortho ,vip,', phone: '' })
  assert.equal(created.fullName, 'Dr A')
  assert.equal(created.email, 'a@b.co')
  assert.deepEqual(created.tags, ['vip', 'ortho'])
  assert.equal(created.phone, null)
  assert.equal(created.status, 'lead')
  assert.equal(crmCreateSchema.safeParse({ fullName: '' }).success, false)
  assert.equal(crmPatchSchema.safeParse({ email: 'not-an-email' }).success, false)
  assert.equal(crmPatchSchema.safeParse({ nextFollowUp: '2026-02-30x' }).success, false)
  assert.equal(crmPatchSchema.safeParse({ status: 'won' }).success, false)
  assert.equal(crmPatchSchema.safeParse({ doctorAccountId: 1 }).success, false, 'link key cannot be set by clients')
  assert.deepEqual(crmPatchSchema.parse({ nextFollowUp: '' }), { nextFollowUp: null })
})

test('unpaid totals are summed per currency', () => {
  assert.deepEqual(sumByCurrency([
    { currency: 'IDR', amount: 1000 }, { currency: 'SGD', amount: 10.1 }, { currency: 'IDR', amount: 500 },
    { currency: 'SGD', amount: 0.2 }, { currency: 'THB', amount: null },
  ]), [{ currency: 'IDR', amount: 1500 }, { currency: 'SGD', amount: 10.3 }])
})

test('follow-up state', () => {
  assert.equal(followUpState(null, '2026-11-17'), 'none')
  assert.equal(followUpState('2026-11-16', '2026-11-17'), 'overdue')
  assert.equal(followUpState('2026-11-17', '2026-11-17'), 'today')
  assert.equal(followUpState('2026-11-18', '2026-11-17'), 'upcoming')
})
