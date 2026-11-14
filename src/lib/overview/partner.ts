import { IDESIGN_PROGRESS_OPTIONS } from '@/lib/idesign/orders'
import { calculateAutomaticTreatmentProgress } from '@/lib/idesign/schedule'
import { displayFinanceTotal, isFinanceOverdue } from '@/lib/finance/calc'
import { isTerminalOrderStatus } from '@/lib/orderStatus'

// Pure builders for the doctor / sales overview. No database imports, so they are unit tested.

export const WEAR_REMINDER_DAYS = 7
const LIST_LIMIT = 6

/** Aligner stages that come after approval, where a wear schedule is expected. */
export const POST_APPROVAL_PROGRESS = ['Approved', 'In Production', 'Produced', 'Shipped', 'Delivered'] as const

export interface PartnerAlignerCaseInput {
  id: number
  orderNo: string
  patientName: string
  latestProgress: string
  createdOn: string
  updatedAt: string
  doctorAccountId: number | null
  doctorName: string | null
  hasCourse: boolean
}

export interface PartnerCourseInput {
  caseId: number
  totalSteps: number
  status: string
  today: string
  stages: Array<{ stepNumber: number; suggestedStartDate: string; suggestedEndDate: string }>
}

export interface PartnerCaseItem {
  id: number
  orderNo: string
  patientName: string
  latestProgress: string
  doctorName: string | null
  updatedAt: string
}

export interface PartnerWearItem extends PartnerCaseItem {
  currentStage: number
  totalSteps: number
  nextChange: string | null
  finishDate: string | null
  daysToNextChange: number | null
  dueSoon: boolean
}

export interface TrendPoint { key: string; label: string; count: number }

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

export function monthKey(date: Date) {
  return date.toISOString().slice(0, 7)
}

export function buildMonthlyTrend(dates: string[], now = new Date(), months = 6): TrendPoint[] {
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1 - index), 1))
    const key = monthKey(date)
    return {
      key,
      label: date.toLocaleDateString('en-AU', { month: 'short', timeZone: 'UTC' }),
      count: dates.filter((value) => value.startsWith(key)).length,
    }
  })
}

function toItem(row: PartnerAlignerCaseInput): PartnerCaseItem {
  return { id: row.id, orderNo: row.orderNo, patientName: row.patientName, latestProgress: row.latestProgress, doctorName: row.doctorName, updatedAt: row.updatedAt }
}

const byUpdatedDesc = (left: PartnerAlignerCaseInput, right: PartnerAlignerCaseInput) => right.updatedAt.localeCompare(left.updatedAt)
const byUpdatedAsc = (left: PartnerAlignerCaseInput, right: PartnerAlignerCaseInput) => left.updatedAt.localeCompare(right.updatedAt)

export function buildAlignerOverview(cases: PartnerAlignerCaseInput[], courses: PartnerCourseInput[], now = new Date()) {
  const pipeline = Object.fromEntries(IDESIGN_PROGRESS_OPTIONS.map((status) => [status, 0])) as Record<string, number>
  for (const row of cases) pipeline[row.latestProgress] = (pipeline[row.latestProgress] ?? 0) + 1

  const thisMonth = monthKey(now)
  const awaiting = cases.filter((row) => row.latestProgress === 'Awaiting Approval')
  const entering = cases.filter((row) => row.latestProgress === 'Entering Info')
  const needsSchedule = cases.filter((row) => !row.hasCourse && (POST_APPROVAL_PROGRESS as readonly string[]).includes(row.latestProgress))

  const casesById = new Map(cases.map((row) => [row.id, row]))
  const wearing: PartnerWearItem[] = []
  for (const course of courses) {
    const row = casesById.get(course.caseId)
    if (!row || course.status !== 'active') continue
    const progress = calculateAutomaticTreatmentProgress(course.stages, course.today)
    if (!progress || progress.status === 'completed') continue
    const finishDate = course.stages.reduce<string | null>((latest, stage) => (!latest || stage.suggestedEndDate > latest ? stage.suggestedEndDate : latest), null)
    const daysToNextChange = progress.nextSuggestedChange ? daysBetween(course.today, progress.nextSuggestedChange) : null
    const daysToFinish = finishDate ? daysBetween(course.today, finishDate) : null
    const dueSoon = (daysToNextChange !== null && daysToNextChange <= WEAR_REMINDER_DAYS) || (daysToFinish !== null && daysToFinish <= WEAR_REMINDER_DAYS)
    wearing.push({
      ...toItem(row),
      currentStage: progress.currentStage,
      totalSteps: course.totalSteps,
      nextChange: progress.nextSuggestedChange,
      finishDate,
      daysToNextChange,
      dueSoon,
    })
  }
  wearing.sort((left, right) => Number(right.dueSoon) - Number(left.dueSoon) || (left.daysToNextChange ?? 9_999) - (right.daysToNextChange ?? 9_999))

  return {
    totals: {
      all: cases.length,
      active: cases.filter((row) => row.latestProgress !== 'Completed').length,
      newThisMonth: cases.filter((row) => row.createdOn.startsWith(thisMonth)).length,
      completed: pipeline.Completed ?? 0,
      awaitingApproval: awaiting.length,
      wearing: wearing.length,
    },
    pipeline,
    awaitingApproval: [...awaiting].sort(byUpdatedAsc).slice(0, LIST_LIMIT).map(toItem),
    enteringInfo: [...entering].sort(byUpdatedDesc).slice(0, LIST_LIMIT).map(toItem),
    enteringInfoCount: entering.length,
    needsSchedule: [...needsSchedule].sort(byUpdatedDesc).slice(0, LIST_LIMIT).map(toItem),
    needsScheduleCount: needsSchedule.length,
    wearing: wearing.slice(0, 8),
    wearDueSoonCount: wearing.filter((item) => item.dueSoon).length,
    trend: buildMonthlyTrend(cases.map((row) => row.createdOn), now),
  }
}

export interface PartnerFinanceInput {
  paymentStatus: string
  dueDate: string | null
  invoiceDate: string | null
  originalPrice: string | null
  discount: string | null
  totalAmount: string | null
  currency: string | null
}

export interface CurrencyAmount { currency: string; amount: number }

function addAmount(target: Map<string, number>, currency: string | null, amount: number | null) {
  if (amount === null) return
  const key = currency || '—'
  target.set(key, (target.get(key) ?? 0) + amount)
}

function sortedAmounts(values: Map<string, number>): CurrencyAmount[] {
  return [...values.entries()].map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 })).sort((left, right) => right.amount - left.amount)
}

export function buildFinanceSummary(rows: PartnerFinanceInput[], overdueDays: number, today = new Date().toISOString().slice(0, 10)) {
  const unpaid = new Map<string, number>()
  const overdue = new Map<string, number>()
  let unpaidCount = 0
  let overdueCount = 0
  for (const row of rows) {
    if (row.paymentStatus !== 'Unpaid') continue
    const amount = displayFinanceTotal(row)
    unpaidCount += 1
    addAmount(unpaid, row.currency, amount)
    if (isFinanceOverdue(row, overdueDays, today)) {
      overdueCount += 1
      addAmount(overdue, row.currency, amount)
    }
  }
  return { unpaidCount, overdueCount, unpaid: sortedAmounts(unpaid), overdue: sortedAmounts(overdue) }
}

export interface PartnerLabOrderInput {
  id: number
  orderNo: string
  patientName: string
  status: string
  treatmentType: string | null
  createdAt: string
  statusUpdatedAt: string
  submittedBy: number | null
}

export interface PartnerLabItem { id: number; orderNo: string; patientName: string; status: string; treatmentType: string | null; statusUpdatedAt: string }

const toLabItem = (row: PartnerLabOrderInput): PartnerLabItem => ({ id: row.id, orderNo: row.orderNo, patientName: row.patientName, status: row.status, treatmentType: row.treatmentType, statusUpdatedAt: row.statusUpdatedAt })

export function buildLabExtras(rows: PartnerLabOrderInput[]) {
  const byRecent = (left: PartnerLabOrderInput, right: PartnerLabOrderInput) => right.statusUpdatedAt.localeCompare(left.statusUpdatedAt)
  const productCounts = new Map<string, number>()
  for (const row of rows) {
    const product = row.treatmentType?.trim() || 'Other'
    productCounts.set(product, (productCounts.get(product) ?? 0) + 1)
  }
  const products = [...productCounts.entries()].map(([label, count]) => ({ label, count })).sort((left, right) => right.count - left.count)
  const topProducts = products.slice(0, 5)
  const otherCount = products.slice(5).reduce((sum, item) => sum + item.count, 0)
  if (otherCount > 0) topProducts.push({ label: 'Others', count: otherCount })
  return {
    redo: rows.filter((row) => row.status === 'redo').sort(byRecent).slice(0, LIST_LIMIT).map(toLabItem),
    inTransit: rows.filter((row) => row.status === 'shipped').sort(byRecent).slice(0, LIST_LIMIT).map(toLabItem),
    inTransitCount: rows.filter((row) => row.status === 'shipped').length,
    productMix: topProducts,
  }
}

export interface DoctorSummaryInput { id: number; name: string }

/** Sales "My doctors" table: one row per doctor with aligner and lab workload. */
export function buildDoctorSummaries(doctors: DoctorSummaryInput[], cases: PartnerAlignerCaseInput[], labOrders: PartnerLabOrderInput[]) {
  return doctors.map((doctor) => {
    const doctorCases = cases.filter((row) => row.doctorAccountId === doctor.id)
    const doctorOrders = labOrders.filter((row) => row.submittedBy === doctor.id)
    return {
      id: doctor.id,
      name: doctor.name,
      activeAligners: doctorCases.filter((row) => row.latestProgress !== 'Completed').length,
      awaitingApproval: doctorCases.filter((row) => row.latestProgress === 'Awaiting Approval').length,
      activeLabOrders: doctorOrders.filter((row) => !isTerminalOrderStatus(row.status)).length,
    }
  }).sort((left, right) => (right.awaitingApproval - left.awaitingApproval) || (right.activeAligners + right.activeLabOrders) - (left.activeAligners + left.activeLabOrders) || left.name.localeCompare(right.name))
}
