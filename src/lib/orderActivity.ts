export const ORDER_NOTE_MAX_LENGTH = 200

export type OrderActivityItem = {
  id: number
  eventType: string
  detail: string
  actorName: string
  createdAt: string
}

export function normalizeOrderNote(value: unknown): { value?: string | null; error?: string } {
  if (typeof value !== 'string') return { error: 'Note must be text' }
  const note = value.trim()
  if (note.length > ORDER_NOTE_MAX_LENGTH) return { error: `Note must be ${ORDER_NOTE_MAX_LENGTH} characters or fewer` }
  return { value: note || null }
}
