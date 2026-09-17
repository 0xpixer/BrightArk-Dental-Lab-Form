type LarkWebhookResponse = {
  code?: unknown
  msg?: unknown
  StatusCode?: unknown
  StatusMessage?: unknown
}

export interface LarkOrder {
  id: number
  orderNo: string
  clinic: string
  treatmentType: string | null
  createdAt: Date
}

interface LarkDeliveryOptions {
  webhookUrl: string | undefined
  appUrl: string
  recordDelivery: (orderId: number) => Promise<void>
  fetcher?: typeof fetch
  reportError?: (message: string) => void
}

export async function notifyLarkOfOrder(order: LarkOrder, options: LarkDeliveryOptions): Promise<boolean> {
  const { webhookUrl, appUrl, recordDelivery, fetcher = fetch, reportError = console.error } = options
  try {
    if (!webhookUrl) throw new Error('LARK_WEBHOOK_URL is not configured')
    const text = [
      'New BrightArk case submitted',
      `Order: ${order.orderNo}`,
      `Clinic: ${order.clinic}`,
      `Treatment: ${order.treatmentType ?? 'Not selected'}`,
      `Submitted: ${order.createdAt.toLocaleString('en-AU', { timeZone: 'Asia/Jakarta' })} WIB`,
      `View: ${appUrl.replace(/\/$/, '')}/admin/submissions/${order.id}`,
    ].join('\n')

    const response = await fetcher(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg_type: 'text', content: { text } }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`Lark webhook returned HTTP ${response.status}`)

    const responseBody: unknown = await response.json().catch(() => null)
    const error = getLarkWebhookError(responseBody)
    if (error) throw new Error(error)

    // Delivery is recorded only after Lark acknowledges the message.
    await recordDelivery(order.id)
    return true
  } catch (error) {
    reportError(`Lark notification failed for order ${order.orderNo}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    return false
  }
}

function formatError(message: unknown, code: unknown) {
  const text = typeof message === 'string' && message.trim() ? message : 'Lark rejected the message'
  return `${text} (code ${String(code)})`
}

export function getLarkWebhookError(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Unrecognized Lark webhook response'

  const response = value as LarkWebhookResponse
  if (response.code !== undefined) {
    return response.code === 0 ? null : formatError(response.msg, response.code)
  }
  if (response.StatusCode !== undefined) {
    return response.StatusCode === 0 ? null : formatError(response.StatusMessage, response.StatusCode)
  }

  return 'Unrecognized Lark webhook response'
}
