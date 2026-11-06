import assert from 'node:assert/strict'
import test from 'node:test'
import { createIDesignCaseOrderNo, createIDesignCaseSchema, IDESIGN_REQUIRED_FILE_SLOTS, updateIDesignCaseInformationSchema } from './cases'

const requiredFiles = Object.fromEntries(IDESIGN_REQUIRED_FILE_SLOTS.map((slot) => {
  const extension = slot.endsWith('model') ? 'stl' : 'jpg'
  return [slot, [{
  url: `https://example.public.blob.vercel-storage.com/idesign/${slot}.${extension}`,
  name: `${slot}.${extension}`,
  size: 120,
  type: extension === 'stl' ? 'model/stl' : 'image/jpeg',
}]]
}))

const validCase = {
  patientName: 'Patient One',
  gender: 'Female',
  dateOfBirth: '2000-02-20',
  fileUrls: {
    ...requiredFiles,
    occlusion: [{
      url: 'https://example.public.blob.vercel-storage.com/idesign/occlusion.ply',
      name: 'occlusion.ply',
      size: 120,
      type: 'model/ply',
    }],
  },
  dentitionStage: 'Permanent Dentition',
  chiefComplaints: ['Crowded teeth', 'Other: Improve the smile arc'],
  extractionTeeth: [18, 11, 21],
  lockedTeeth: [],
  attachmentRestrictedTeeth: [55],
  iprRestrictedTeeth: [],
  reserveSpaceTeeth: [31],
  maxillaryMidline: 'Auto',
  mandibularMidline: null,
  leftRelationship: 'Maintain',
  rightRelationship: 'Auto',
  posteriorExpansionNotAllowed: { maxillary: false, mandibular: true },
  iprNotAllowed: { upperAnterior: false, upperLeftPosterior: false, upperRightPosterior: false, lowerAnterior: false, lowerLeftPosterior: false, lowerRightPosterior: false },
  molarDistalizationNotAllowed: { upperLeft: false, upperRight: false, lowerLeft: false, lowerRight: false },
  remarks: 'Keep the current midline.',
}

test('accepts a complete clear aligner case with FDI tooth selections', () => {
  const parsed = createIDesignCaseSchema.safeParse(validCase)
  assert.equal(parsed.success, true)
})

test('rejects missing required scans or facial photos and invalid teeth', () => {
  const missingScan = createIDesignCaseSchema.safeParse({ ...validCase, fileUrls: { ...requiredFiles, 'upper-model': [] } })
  assert.equal(missingScan.success, false)
  const invalidTooth = createIDesignCaseSchema.safeParse({ ...validCase, extractionTeeth: [99] })
  assert.equal(invalidTooth.success, false)
})

test('rejects unknown chief complaint values', () => {
  const parsed = createIDesignCaseSchema.safeParse({ ...validCase, chiefComplaints: ['Unknown complaint'] })
  assert.equal(parsed.success, false)
})

test('accepts STL or PLY oral scans and rejects other occlusion formats', () => {
  const plyUpper = createIDesignCaseSchema.safeParse({
    ...validCase,
    fileUrls: {
      ...validCase.fileUrls,
      'upper-model': [{ ...requiredFiles['upper-model'][0], name: 'upper-model.ply', type: 'model/ply' }],
    },
  })
  assert.equal(plyUpper.success, true)
  const invalidOcclusion = createIDesignCaseSchema.safeParse({
    ...validCase,
    fileUrls: {
      ...validCase.fileUrls,
      occlusion: [{ ...validCase.fileUrls.occlusion[0], name: 'occlusion.pdf', type: 'application/pdf' }],
    },
  })
  assert.equal(invalidOcclusion.success, false)
})

test('allows an admin to update a legacy case without requiring missing case files', () => {
  const parsed = updateIDesignCaseInformationSchema.safeParse({ ...validCase, gender: null, dateOfBirth: null, fileUrls: {} })
  assert.equal(parsed.success, true)
})

test('creates recognisable, unique iDesign order numbers', () => {
  const now = new Date('2026-09-20T00:00:00Z')
  const first = createIDesignCaseOrderNo(now)
  const second = createIDesignCaseOrderNo(now)
  assert.match(first, /^IDA-20260920-[A-F0-9]{6}$/)
  assert.notEqual(first, second)
})
