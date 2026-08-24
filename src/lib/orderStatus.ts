export const ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'lab_designing', label: 'Lab Designing' },
  { value: 'in_production', label: 'In Production' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'redo', label: 'Re-Do' },
  { value: 'completed', label: 'Completed' },
] as const

export type OrderStatus = (typeof ORDER_STATUS_OPTIONS)[number]['value']

export const ORDER_STATUS_VALUES = new Set<string>(ORDER_STATUS_OPTIONS.map((option) => option.value))
export const ORDER_STATUS_FILTER_VALUES = new Set<string>(['all', 'overdue', ...ORDER_STATUS_VALUES])
export const ORDER_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  ORDER_STATUS_OPTIONS.map((option) => [option.value, option.label]),
)

export function normalizeOrderStatusFilter(value: string | string[] | undefined): string {
  const status = Array.isArray(value) ? value[0] : value
  return status && ORDER_STATUS_FILTER_VALUES.has(status) ? status : 'all'
}

export const ORDER_STATUS_STYLES: Record<string, string> = {
  pending: 'border-yellow-200 bg-yellow-100 text-yellow-800',
  lab_designing: 'border-cyan-200 bg-cyan-100 text-cyan-800',
  in_production: 'border-blue-200 bg-blue-100 text-blue-800',
  shipped: 'border-violet-200 bg-violet-100 text-violet-800',
  delivered: 'border-teal-200 bg-teal-100 text-teal-800',
  redo: 'border-pink-200 bg-pink-100 text-pink-800',
  completed: 'border-green-200 bg-green-100 text-green-800',
}

export const ORDER_STATUS_CHART_COLORS: Record<string, string> = {
  pending: '#eab308',
  lab_designing: '#06b6d4',
  in_production: '#3b82f6',
  shipped: '#8b5cf6',
  delivered: '#14b8a6',
  redo: '#ec4899',
  completed: '#22c55e',
}

export const ORDER_STATUS_DUE_MS = 3 * 24 * 60 * 60 * 1000
export const DELIVERED_AUTO_COMPLETE_MS = 14 * 24 * 60 * 60 * 1000

export function isOrderStatusOverdue(status: string, statusUpdatedAt: string | Date, now = new Date()): boolean {
  if (status === 'completed') return false
  const updatedAt = new Date(statusUpdatedAt)
  if (Number.isNaN(updatedAt.getTime())) return false
  return now.getTime() - updatedAt.getTime() >= ORDER_STATUS_DUE_MS
}

export function isDeliveredReadyForCompletion(status: string, statusUpdatedAt: string | Date, now = new Date()): boolean {
  if (status !== 'delivered') return false
  const updatedAt = new Date(statusUpdatedAt)
  if (Number.isNaN(updatedAt.getTime())) return false
  return now.getTime() - updatedAt.getTime() >= DELIVERED_AUTO_COMPLETE_MS
}
