import assert from 'node:assert/strict'
import test from 'node:test'
import JSZip from 'jszip'
import { buildIDesignCaseFilesZip, isTrustedCaseFileUrl } from './buildCaseFilesZip'

test('only accepts BrightArk Vercel Blob file locations', () => {
  assert.equal(isTrustedCaseFileUrl('https://example.public.blob.vercel-storage.com/idesign/file.stl'), true)
  assert.equal(isTrustedCaseFileUrl('http://example.public.blob.vercel-storage.com/idesign/file.stl'), false)
  assert.equal(isTrustedCaseFileUrl('https://example.public.blob.vercel-storage.com.attacker.test/file.stl'), false)
  assert.equal(isTrustedCaseFileUrl('not-a-url'), false)
})

test('packages case files by slot, sanitizes names, and records unavailable files', async () => {
  const zipBuffer = await buildIDesignCaseFilesZip({
    'upper-model': [{ url: 'https://example.public.blob.vercel-storage.com/upper.stl', name: '../Upper scan.stl' }],
    photos: [{ url: 'https://untrusted.example.test/photo.jpg', name: 'patient photo.jpg' }],
  }, async () => new Response('solid-data', { status: 200 }))

  assert.ok(zipBuffer)
  const zip = await JSZip.loadAsync(zipBuffer!)
  assert.equal(await zip.file('upper-model/01_Upper_scan.stl')?.async('string'), 'solid-data')
  const errors = await zip.file('download-errors.txt')?.async('string')
  assert.match(errors ?? '', /photos\/01_patient_photo.jpg: unsupported file location/)
})

test('returns null when a case has no uploaded files', async () => {
  assert.equal(await buildIDesignCaseFilesZip({}), null)
})
