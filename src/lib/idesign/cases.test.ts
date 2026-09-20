import assert from 'node:assert/strict'
import test from 'node:test'
import { createIDesignCaseOrderNo, createIDesignCaseSchema, IDESIGN_REQUIRED_FILE_SLOTS } from './cases'

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
  fileUrls: requiredFiles,
  dentitionStage: 'Permanent Dentition',
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

test('creates recognisable, unique iDesign order numbers', () => {
  const now = new Date('2026-09-20T00:00:00Z')
  const first = createIDesignCaseOrderNo(now)
  const second = createIDesignCaseOrderNo(now)
  assert.match(first, /^IDA-20260920-[A-F0-9]{6}$/)
  assert.notEqual(first, second)
})
