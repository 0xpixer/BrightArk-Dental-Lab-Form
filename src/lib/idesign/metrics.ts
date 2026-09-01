import { IDESIGN_PROGRESS_OPTIONS } from './orders'

export interface IDesignMetricRow {
  sourceCreatedOn: string | null
  latestProgress: string
  paymentStatus: string
  category: string
}

export interface IDesignTrendPoint {
  key: string
  label: string
  count: number
}

export function buildIDesignMetrics(rows: IDesignMetricRow[], now = new Date()) {
  const currentMonth = monthKey(now)
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const previousMonth = monthKey(previous)
  const statusCounts = Object.fromEntries(IDESIGN_PROGRESS_OPTIONS.map((status) => [status, 0])) as Record<string, number>
  const categoryCounts: Record<string, number> = {}

  for (const row of rows) {
    statusCounts[row.latestProgress] = (statusCounts[row.latestProgress] ?? 0) + 1
    categoryCounts[row.category] = (categoryCounts[row.category] ?? 0) + 1
  }

  const trend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1))
    const key = monthKey(date)
    return {
      key,
      label: date.toLocaleDateString('en-AU', { month: 'short', timeZone: 'UTC' }),
      count: rows.filter((row) => row.sourceCreatedOn?.startsWith(key)).length,
    }
  })

  const newCasesThisMonth = rows.filter((row) => row.sourceCreatedOn?.startsWith(currentMonth)).length

  return {
    total: rows.length,
    newCasesThisMonth,
    casesLastMonth: rows.filter((row) => row.sourceCreatedOn?.startsWith(previousMonth)).length,
    paid: rows.filter((row) => row.paymentStatus === 'Paid').length,
    unpaid: rows.filter((row) => row.paymentStatus === 'Unpaid').length,
    progressPercent: Math.min(100, Math.round(newCasesThisMonth / 10 * 100)),
    monthlyGoal: 10,
    statusCounts,
    categoryCounts,
    trend,
  }
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}
