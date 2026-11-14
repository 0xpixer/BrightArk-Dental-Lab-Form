import { IDESIGN_CATEGORIES, IDESIGN_PROGRESS_OPTIONS } from '@/lib/idesign/orders'
import { displayFinanceTotal, isFinanceOverdue } from '@/lib/finance/calc'
import { isOrderStatusOverdue, isTerminalOrderStatus } from '@/lib/orderStatus'
import { buildMonthlyTrend, monthKey, type CurrencyAmount } from './partner'

// Pure builders for the admin / superadmin / designer overview. No database imports.

/** Days a case may sit in a stage before it is flagged for follow-up. */
export const ADMIN_QUEUE_THRESHOLDS = {
  designDays: 3,
  approvalDays: 5,
  enteringInfoDays: 5,
  labPendingDays: 2,
} as const

export const SALES_TARGETS_KEY = 'sales_monthly_targets'
const QUEUE_LIMIT = 6
const LEADERBOARD_LIMIT = 8

export function daysSince(value: string, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(value)) / 86_400_000))
}

/** Targets are stored as {"<salesId>": <cases per month>}; anything invalid is dropped. */
export function parseSalesTargets(value: string | null | undefined): Record<number, number> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    const result: Record<number, number> = {}
    for (const [key, raw] of Object.entries(parsed ?? {})) {
      const id = Number(key)
      const target = Number(raw)
      if (Number.isSafeInteger(id) && id > 0 && Number.isFinite(target) && target > 0) result[id] = Math.round(target)
    }
    return result
  } catch {
    return {}
  }
}

export interface AdminCaseInput {
  id: number
  orderNo: string
  patientName: string
  latestProgress: string
  createdOn: string
  updatedAt: string
  doctorAccountId: number | null
  doctorName: string | null
  salesAccountId: number | null
  salesName: string | null
  category: string
}

export interface AdminQueueItem {
  id: number
  orderNo: string
  patientName: string
  latestProgress: string
  doctorName: string | null
  salesName: string | null
  ageDays: number
}

export interface AdminQueue { key: string; count: number; items: AdminQueueItem[] }

function queue(key: string, rows: AdminCaseInput[], now: Date): AdminQueue {
  const items = rows
    .map((row) => ({ id: row.id, orderNo: row.orderNo, patientName: row.patientName, latestProgress: row.latestProgress, doctorName: row.doctorName, salesName: row.salesName, ageDays: daysSince(row.updatedAt, now) }))
    .sort((left, right) => right.ageDays - left.ageDays)
  return { key, count: items.length, items: items.slice(0, QUEUE_LIMIT) }
}

export interface SalesAccountInput { id: number; name: string }

export function buildAdminAlignerOverview(cases: AdminCaseInput[], salesAccounts: SalesAccountInput[], targets: Record<number, number>, now = new Date()) {
  const thisMonth = monthKey(now)
  const lastMonth = monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)))
  const age = (row: AdminCaseInput) => daysSince(row.updatedAt, now)
  const pipeline = Object.fromEntries(IDESIGN_PROGRESS_OPTIONS.map((status) => [status, 0])) as Record<string, number>
  for (const row of cases) pipeline[row.latestProgress] = (pipeline[row.latestProgress] ?? 0) + 1
  const open = cases.filter((row) => row.latestProgress !== 'Completed')

  const queues = [
    queue('design', cases.filter((row) => row.latestProgress === 'Lab Designing' && age(row) >= ADMIN_QUEUE_THRESHOLDS.designDays), now),
    queue('approval', cases.filter((row) => row.latestProgress === 'Awaiting Approval' && age(row) >= ADMIN_QUEUE_THRESHOLDS.approvalDays), now),
    queue('production', cases.filter((row) => row.latestProgress === 'Approved'), now),
    queue('unassigned', open.filter((row) => !row.doctorAccountId || !row.salesAccountId), now),
    queue('entering', cases.filter((row) => row.latestProgress === 'Entering Info' && age(row) >= ADMIN_QUEUE_THRESHOLDS.enteringInfoDays), now),
  ]

  const categories = [...new Set<string>([...IDESIGN_CATEGORIES, ...cases.map((row) => row.category)])]
  const months = buildMonthlyTrend([], now)
  const trend = months.map((point) => {
    const monthCases = cases.filter((row) => row.createdOn.startsWith(point.key))
    const byCategory = Object.fromEntries(categories.map((category) => [category, monthCases.filter((row) => row.category === category).length]))
    return { key: point.key, label: point.label, count: monthCases.length, byCategory }
  })

  const isNew = (row: AdminCaseInput) => row.createdOn.startsWith(thisMonth)
  const salesRows = salesAccounts.map((account) => {
    const own = cases.filter((row) => row.salesAccountId === account.id)
    const actual = own.filter(isNew).length
    const target = targets[account.id] ?? 0
    return { id: account.id, name: account.name, newThisMonth: actual, active: own.filter((row) => row.latestProgress !== 'Completed').length, target, percent: target ? Math.round(actual / target * 100) : null }
  }).sort((left, right) => right.newThisMonth - left.newThisMonth || right.active - left.active || left.name.localeCompare(right.name))

  const doctorMap = new Map<string, { id: number | null; name: string; newThisMonth: number; active: number }>()
  for (const row of cases) {
    const name = row.doctorName ?? 'Unassigned'
    const key = row.doctorAccountId ? `id:${row.doctorAccountId}` : `name:${name}`
    const entry = doctorMap.get(key) ?? { id: row.doctorAccountId, name, newThisMonth: 0, active: 0 }
    if (isNew(row)) entry.newThisMonth += 1
    if (row.latestProgress !== 'Completed') entry.active += 1
    doctorMap.set(key, entry)
  }
  const doctorRows = [...doctorMap.values()]
    .filter((row) => row.newThisMonth > 0 || row.active > 0)
    .sort((left, right) => right.newThisMonth - left.newThisMonth || right.active - left.active || left.name.localeCompare(right.name))
    .slice(0, LEADERBOARD_LIMIT)

  const totalTarget = salesRows.reduce((sum, row) => sum + row.target, 0)
  const newThisMonth = cases.filter(isNew).length
  return {
    totals: {
      all: cases.length,
      active: open.length,
      newThisMonth,
      newLastMonth: cases.filter((row) => row.createdOn.startsWith(lastMonth)).length,
      awaitingApproval: pipeline['Awaiting Approval'] ?? 0,
      inDesign: pipeline['Lab Designing'] ?? 0,
    },
    pipeline,
    queues,
    categories,
    trend,
    targets: { totalTarget, actual: salesRows.reduce((sum, row) => sum + row.newThisMonth, 0), percent: totalTarget ? Math.round(salesRows.reduce((sum, row) => sum + row.newThisMonth, 0) / totalTarget * 100) : null },
    salesLeaderboard: salesRows,
    doctorLeaderboard: doctorRows,
  }
}

export interface AdminFinanceInput {
  paymentStatus: string
  dueDate: string | null
  invoiceDate: string | null
  originalPrice: string | null
  discount: string | null
  totalAmount: string | null
  currency: string | null
}

function sumByCurrency(rows: AdminFinanceInput[]): CurrencyAmount[] {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const amount = displayFinanceTotal(row)
    if (amount === null) continue
    const key = row.currency || '—'
    totals.set(key, (totals.get(key) ?? 0) + amount)
  }
  return [...totals.entries()].map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 })).sort((left, right) => right.amount - left.amount)
}

/** Invoiced = Unpaid + Paid rows; Free and not-yet-invoiced rows are left out of money totals. */
export function buildAdminFinance(rows: AdminFinanceInput[], overdueDays: number, today = new Date().toISOString().slice(0, 10)) {
  const paid = rows.filter((row) => row.paymentStatus === 'Paid')
  const unpaid = rows.filter((row) => row.paymentStatus === 'Unpaid')
  const overdue = unpaid.filter((row) => isFinanceOverdue(row, overdueDays, today))
  return {
    counts: { invoiced: paid.length + unpaid.length, paid: paid.length, unpaid: unpaid.length, overdue: overdue.length, notInvoiced: rows.filter((row) => row.paymentStatus === 'Invoice not issue').length },
    invoiced: sumByCurrency([...paid, ...unpaid]),
    paid: sumByCurrency(paid),
    unpaid: sumByCurrency(unpaid),
    overdue: sumByCurrency(overdue),
    overdueDays,
  }
}

export interface AdminLabOrderInput {
  id: number
  orderNo: string
  patientName: string
  status: string
  treatmentType: string | null
  createdAt: string
  statusUpdatedAt: string
  doctorId: number | null
  doctorName: string | null
  salesIds: number[]
}

export interface AdminLabQueueItem { id: number; orderNo: string; patientName: string; status: string; doctorName: string | null; ageDays: number }

function labQueue(key: string, rows: AdminLabOrderInput[], now: Date) {
  const items = rows
    .map((row) => ({ id: row.id, orderNo: row.orderNo, patientName: row.patientName, status: row.status, doctorName: row.doctorName, ageDays: daysSince(row.statusUpdatedAt, now) }))
    .sort((left, right) => right.ageDays - left.ageDays)
  return { key, count: items.length, items: items.slice(0, QUEUE_LIMIT) }
}

export function buildAdminLabOverview(rows: AdminLabOrderInput[], salesAccounts: SalesAccountInput[], now = new Date()) {
  const thisMonth = monthKey(now)
  const queues = [
    labQueue('pending', rows.filter((row) => row.status === 'pending' && daysSince(row.statusUpdatedAt, now) >= ADMIN_QUEUE_THRESHOLDS.labPendingDays), now),
    labQueue('overdue', rows.filter((row) => row.status !== 'pending' && isOrderStatusOverdue(row.status, row.statusUpdatedAt, now)), now),
    labQueue('redo', rows.filter((row) => row.status === 'redo'), now),
  ]
  const isNew = (row: AdminLabOrderInput) => row.createdAt.startsWith(thisMonth)
  const active = (row: AdminLabOrderInput) => !isTerminalOrderStatus(row.status)

  const doctorMap = new Map<string, { id: number | null; name: string; newThisMonth: number; active: number }>()
  for (const row of rows) {
    const name = row.doctorName ?? 'Unknown'
    const key = row.doctorId ? `id:${row.doctorId}` : `name:${name}`
    const entry = doctorMap.get(key) ?? { id: row.doctorId, name, newThisMonth: 0, active: 0 }
    if (isNew(row)) entry.newThisMonth += 1
    if (active(row)) entry.active += 1
    doctorMap.set(key, entry)
  }
  const salesLeaderboard = salesAccounts.map((account) => {
    const own = rows.filter((row) => row.salesIds.includes(account.id))
    return { id: account.id, name: account.name, newThisMonth: own.filter(isNew).length, active: own.filter(active).length }
  }).filter((row) => row.newThisMonth > 0 || row.active > 0)
    .sort((left, right) => right.newThisMonth - left.newThisMonth || right.active - left.active || left.name.localeCompare(right.name))

  return {
    queues,
    newThisMonth: rows.filter(isNew).length,
    newLastMonth: rows.filter((row) => row.createdAt.startsWith(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))))).length,
    doctorLeaderboard: [...doctorMap.values()].filter((row) => row.newThisMonth > 0 || row.active > 0).sort((left, right) => right.newThisMonth - left.newThisMonth || right.active - left.active || left.name.localeCompare(right.name)).slice(0, LEADERBOARD_LIMIT),
    salesLeaderboard: salesLeaderboard.slice(0, LEADERBOARD_LIMIT),
  }
}
