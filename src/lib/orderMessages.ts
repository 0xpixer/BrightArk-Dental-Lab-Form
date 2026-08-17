export const MAX_ORDER_MESSAGE_LENGTH = 2000

export type MessageAuthor = 'Doctor' | 'Lab' | 'Admin'

export function getMessageAuthor(role: string): MessageAuthor | null {
  if (role === 'doctor' || role === 'clinic_staff') return 'Doctor'
  if (role === 'admin') return 'Lab'
  if (role === 'superadmin') return 'Admin'
  return null
}

export function parseOrderMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const message = value.trim()
  if (!message || message.length > MAX_ORDER_MESSAGE_LENGTH) return null
  return message
}
