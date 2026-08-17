export const MAX_ORDER_MESSAGE_LENGTH = 2000

export type MessageAuthor = 'Doctor' | 'Lab' | 'Admin'

export interface ParsedOrderMessage {
  message: string | null
  imageUrl: string | null
  imageName: string | null
}

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

export function parseOrderMessagePayload(value: unknown): ParsedOrderMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const payload = value as Record<string, unknown>

  const rawMessage = typeof payload.message === 'string' ? payload.message.trim() : ''
  if (rawMessage.length > MAX_ORDER_MESSAGE_LENGTH) return null

  let imageUrl: string | null = null
  let imageName: string | null = null
  if (payload.imageUrl !== undefined || payload.imageName !== undefined) {
    if (typeof payload.imageUrl !== 'string' || typeof payload.imageName !== 'string') return null
    const trimmedName = payload.imageName.trim()
    if (!trimmedName || trimmedName.length > 255 || !/\.(?:jpe?g|png|webp)$/i.test(trimmedName)) return null
    try {
      const parsedUrl = new URL(payload.imageUrl)
      if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.blob.vercel-storage.com')) return null
      if (!parsedUrl.pathname.split('/').includes('messages')) return null
      if (!/\.(?:jpe?g|png|webp)$/i.test(parsedUrl.pathname)) return null
      imageUrl = payload.imageUrl
      imageName = trimmedName
    } catch {
      return null
    }
  }

  if (!rawMessage && !imageUrl) return null
  return { message: rawMessage || null, imageUrl, imageName }
}
