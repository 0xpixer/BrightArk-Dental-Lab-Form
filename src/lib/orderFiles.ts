const BULK_FILE_KEY = /^bulk-file-\d+$/
const MAX_FILES_PER_REQUEST = 50

export function parseNewOrderFileUrls(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const entries = Object.entries(value)
  if (entries.length === 0 || entries.length > MAX_FILES_PER_REQUEST) return null

  const parsed: Record<string, string> = {}
  for (const [slotId, url] of entries) {
    if (!BULK_FILE_KEY.test(slotId) || typeof url !== 'string') return null
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
