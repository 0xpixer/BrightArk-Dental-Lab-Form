import { isOrderStatusOverdue, isTerminalOrderStatus, ORDER_STATUS_OPTIONS } from './orderStatus'

export type OverviewGranularity = 'week' | 'month'

export interface OverviewOrderInput {
  status: string
  createdAt: string | Date
  statusUpdatedAt: string | Date
}

export interface OverviewTrendPoint {
  key: string
  label: string
  count: number
}

function startOfUtcWeek(date: Date) {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = result.getUTCDay()
  result.setUTCDate(result.getUTCDate() - (day === 0 ? 6 : day - 1))
  return result
}

function formatWeekLabel(date: Date) {
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date)
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat('en-AU', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date)
}

function buildTrend(granularity: OverviewGranularity, now: Date): Array<OverviewTrendPoint & { start: Date; end: Date }> {
  if (granularity === 'week') {
    const currentStart = startOfUtcWeek(now)
    return Array.from({ length: 8 }, (_, index) => {
      const start = new Date(currentStart)
      start.setUTCDate(start.getUTCDate() - (7 - index) * 7)
      const end = new Date(start)
      end.setUTCDate(end.getUTCDate() + 7)
      return { key: start.toISOString().slice(0, 10), label: formatWeekLabel(start), count: 0, start, end }
    })
  }

  return Array.from({ length: 6 }, (_, index) => {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1))
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
    return { key: start.toISOString().slice(0, 7), label: formatMonthLabel(start), count: 0, start, end }
  })
}

export function buildOverviewMetrics(
  orders: OverviewOrderInput[],
  granularity: OverviewGranularity,
  now = new Date(),
) {
  const statusCounts: Record<string, number> = Object.fromEntries(
    ORDER_STATUS_OPTIONS.map((status) => [status.value, 0]),
  )
  const trend = buildTrend(granularity, now)

  for (const order of orders) {
    statusCounts[order.status] = (statusCounts[order.status] ?? 0) + 1
    const createdAt = new Date(order.createdAt)
    const bucket = trend.find((point) => createdAt >= point.start && createdAt < point.end)
    if (bucket) bucket.count += 1
  }

  const completed = statusCounts.completed ?? 0
  const active = orders.filter((order) => !isTerminalOrderStatus(order.status)).length
  const overdue = orders.filter((order) => isOrderStatusOverdue(order.status, order.statusUpdatedAt, now)).length

  return {
    totals: {
      all: orders.length,
      active,
      completed,
      overdue,
    },
    statusCounts,
    trend: trend.map(({ key, label, count }) => ({ key, label, count })),
    periodLabel: granularity === 'week' ? 'Last 8 weeks' : 'Last 6 months',
  }
}
