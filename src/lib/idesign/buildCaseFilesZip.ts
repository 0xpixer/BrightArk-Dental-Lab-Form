import JSZip from 'jszip'

export type IDesignStoredFile = {
  url: string
  name: string
}

export type IDesignStoredFiles = Record<string, IDesignStoredFile[]>

function safePathPart(value: string, fallback: string) {
  const safe = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^[._-]+/, '')
  return safe || fallback
}

export function isTrustedCaseFileUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.endsWith('.public.blob.vercel-storage.com')
  } catch {
    return false
  }
}

export async function buildIDesignCaseFilesZip(fileUrls: IDesignStoredFiles, fetcher: typeof fetch = fetch) {
  const zip = new JSZip()
  const failures: string[] = []
  let added = 0

  for (const [slot, files] of Object.entries(fileUrls)) {
    const folder = safePathPart(slot, 'other')
    for (const [index, file] of files.entries()) {
      const filename = safePathPart(file.name, `file-${index + 1}`)
      const path = `${folder}/${String(index + 1).padStart(2, '0')}_${filename}`
      if (!isTrustedCaseFileUrl(file.url)) {
        failures.push(`${path}: unsupported file location`)
        continue
      }
      try {
        const response = await fetcher(file.url)
        if (!response.ok) {
          failures.push(`${path}: download returned ${response.status}`)
          continue
        }
        zip.file(path, Buffer.from(await response.arrayBuffer()))
        added += 1
      } catch {
        failures.push(`${path}: download failed`)
      }
    }
  }

  if (failures.length > 0) {
    zip.file('download-errors.txt', `Some files could not be included:\n\n${failures.join('\n')}\n`)
  }
  if (added === 0 && failures.length === 0) return null

  return zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' })
}
