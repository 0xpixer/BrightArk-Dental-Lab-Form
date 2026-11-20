import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCrmAccess, canAccessCrmOwner, canChooseCrmOwner, canViewCrm, crmCreateSchema, crmFieldAccess,
  crmPatchSchema, followUpState, crmNeedsContract, isAllowedCrmAvatarUrl, isAllowedCrmContractUrl, lockedFieldsInPatch, normalizeCrmEmail, sumByCurrency,
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

test('doctor photos only accept our own crm-avatars blob uploads', () => {
  const good = 'https://abc123.public.blob.vercel-storage.com/crm-avatars/dr-x-AbC.webp'
  assert.equal(isAllowedCrmAvatarUrl(good), true)
  for (const bad of ['http://abc.public.blob.vercel-storage.com/crm-avatars/x.webp', 'https://evil.com/crm-avatars/x.webp',
    'https://abc.public.blob.vercel-storage.com/finance-invoices/x.pdf', 'javascript:alert(1)', 'not a url']) {
    assert.equal(isAllowedCrmAvatarUrl(bad), false, bad)
  }
  assert.deepEqual(crmPatchSchema.parse({ avatarUrl: good }), { avatarUrl: good })
  assert.deepEqual(crmPatchSchema.parse({ avatarUrl: null }), { avatarUrl: null })
  assert.equal(crmPatchSchema.safeParse({ avatarUrl: 'https://evil.com/x.png' }).success, false)
  // Photos stay CRM-owned, so they are editable even on account-linked records.
  assert.deepEqual(lockedFieldsInPatch({ avatarUrl: good }, crmFieldAccess({ doctorAccountId: 5, assigned: true })), [])
})

test('Tag is one of KA / Non-KA / OEM / Distributor; every tag except Non-KA needs a contract', () => {
  for (const type of ['KA', 'OEM', 'Distributor']) assert.equal(crmNeedsContract(type), true, type)
  for (const type of ['Non-KA', null, '', 'ka']) assert.equal(crmNeedsContract(type), false, String(type))
  assert.deepEqual(crmPatchSchema.parse({ accountType: 'OEM' }), { accountType: 'OEM' })
  assert.deepEqual(crmPatchSchema.parse({ accountType: '' }), { accountType: null })
  assert.equal(crmPatchSchema.safeParse({ accountType: 'VIP' }).success, false)
})

test('Specialty comes from the fixed list', () => {
  assert.deepEqual(crmPatchSchema.parse({ specialty: 'Orthodontics' }), { specialty: 'Orthodontics' })
  assert.deepEqual(crmPatchSchema.parse({ specialty: null }), { specialty: null })
  assert.equal(crmPatchSchema.safeParse({ specialty: 'Brain surgery' }).success, false)
})

test('contracts only accept our own crm-contracts blob uploads', () => {
  const good = 'https://abc.public.blob.vercel-storage.com/crm-contracts/dr-x-contract-Ab1.pdf'
  assert.equal(isAllowedCrmContractUrl(good), true)
  for (const bad of ['https://abc.public.blob.vercel-storage.com/crm-avatars/x.pdf', 'https://evil.com/crm-contracts/x.pdf', 'http://abc.public.blob.vercel-storage.com/crm-contracts/x.pdf']) {
    assert.equal(isAllowedCrmContractUrl(bad), false, bad)
  }
  assert.deepEqual(crmPatchSchema.parse({ contractUrl: good, contractFileName: 'MoU.pdf' }), { contractUrl: good, contractFileName: 'MoU.pdf' })
  assert.equal(crmPatchSchema.safeParse({ contractUrl: 'https://evil.com/x.pdf' }).success, false)
  assert.equal(crmPatchSchema.safeParse({ contractUploadedAt: '2026-01-01' }).success, false, 'upload time is server-owned')
})
