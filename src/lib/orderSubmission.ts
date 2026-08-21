import { orderFormSchema } from '../types/orderForm'
import { parseNewOrderFileUrls } from './orderFiles'

export function parseOrderSubmission(body: unknown) {
  const parsed = orderFormSchema.safeParse(body)
  if (!parsed.success) {
    return { success: false as const, reason: 'form' as const }
  }

  const rawFileUrls = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>).file_urls
    : undefined
  const hasFileUrls = rawFileUrls && typeof rawFileUrls === 'object' && !Array.isArray(rawFileUrls)
    && Object.keys(rawFileUrls).length > 0
  const fileUrls = hasFileUrls ? parseNewOrderFileUrls(rawFileUrls) : {}
  if (!fileUrls) {
    return { success: false as const, reason: 'files' as const }
  }

  return {
    success: true as const,
    values: parsed.data,
    fileUrls,
  }
}
