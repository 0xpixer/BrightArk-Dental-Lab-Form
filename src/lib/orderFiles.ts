const BULK_FILE_KEY = /^bulk-file-\d+$/
const PRODUCTION_FILE_KEY = /^production-file-\d+$/
const MAX_FILES_PER_REQUEST = 50

function parseFileUrls(value: unknown, keyPattern: RegExp): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const entries = Object.entries(value)
  if (entries.length === 0 || entries.length > MAX_FILES_PER_REQUEST) return null

  const parsed: Record<string, string> = {}
  for (const [slotId, url] of entries) {
    if (!keyPattern.test(slotId) || typeof url !== 'string') return null
    try {
      const parsedUrl = new URL(url)
      if (parsedUrl.protocol !== 'https:') return null
    } catch {
      return null
    }
    parsed[slotId] = url
  }
  return parsed
}

export function parseNewOrderFileUrls(value: unknown): Record<string, string> | null {
  return parseFileUrls(value, BULK_FILE_KEY)
}

export function parseProductionFileUrls(value: unknown): Record<string, string> | null {
  return parseFileUrls(value, PRODUCTION_FILE_KEY)
}
