import assert from 'node:assert/strict'
import test from 'node:test'
import { isSupportedCaseFile } from './fileTypes'

test('accepts case images, scans, PDFs, and compressed packages', () => {
  for (const name of ['photo.jpg', 'shade.pdf', 'upper.stl', 'case.zip', 'case.7z', 'case.tar.gz']) {
    assert.equal(isSupportedCaseFile(new File(['test'], name)), true, name)
  }
})

test('rejects unsupported files', () => {
  assert.equal(isSupportedCaseFile(new File(['test'], 'notes.exe')), false)
})
