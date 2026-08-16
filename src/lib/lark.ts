type LarkWebhookResponse = {
  code?: unknown
  msg?: unknown
  StatusCode?: unknown
  StatusMessage?: unknown
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
