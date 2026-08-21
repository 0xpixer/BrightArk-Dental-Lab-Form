import assert from 'node:assert/strict'
import test from 'node:test'
import { getFilePreviewKind } from './filePreview'

test('recognizes uploaded image and STL files from blob URLs', () => {
  assert.equal(getFilePreviewKind('https://example.com/orders/case/scan.STL'), 'stl')
  assert.equal(getFilePreviewKind('https://example.com/orders/case/shade%20photo.jpeg'), 'image')
  assert.equal(getFilePreviewKind('https://example.com/orders/case/arch.webp?download=1'), 'image')
})

test('leaves non-previewable and invalid files as downloads', () => {
  assert.equal(getFilePreviewKind('https://example.com/orders/case/records.pdf'), null)
  assert.equal(getFilePreviewKind('https://example.com/orders/case/package.zip'), null)
  assert.equal(getFilePreviewKind('not-a-url'), null)
})
