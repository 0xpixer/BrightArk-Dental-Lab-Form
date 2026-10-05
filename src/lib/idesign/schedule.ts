import { z } from 'zod'

const dateValue = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Enter a valid date')

export const startTreatmentCourseSchema = z.object({
  startDate: dateValue,
  totalSteps: z.number().int().min(1).max(100),
  defaultDurationDays: z.number().int().min(1).max(60).default(10),
  durations: z.array(z.number().int().min(1).max(60)).min(1).max(100),
  timezone: z.string().trim().min(1).max(80).default('Asia/Jakarta'),
}).superRefine((value, context) => {
  if (value.durations.length !== value.totalSteps) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['durations'], message: 'Add a duration for every step' })
  }
})

export const updateTreatmentDurationsSchema = z.object({
  durations: z.array(z.number().int().min(1).max(60)).min(1).max(100),
})

export interface CalculatedStep {
  stepNumber: number
  durationDays: number
  suggestedStartDate: string
  suggestedEndDate: string
}

export function calculateTreatmentSteps(startDate: string, durations: number[]): CalculatedStep[] {
  let cursor = parseDate(startDate)
  return durations.map((durationDays, index) => {
    const suggestedStartDate = formatDate(cursor)
    const end = addDays(cursor, durationDays - 1)
    const step = { stepNumber: index + 1, durationDays, suggestedStartDate, suggestedEndDate: formatDate(end) }
    cursor = addDays(end, 1)
    return step
  })
}

export function calculateEstimatedFinish(startDate: string, durations: number[]) {
  const steps = calculateTreatmentSteps(startDate, durations)
  return steps.at(-1)?.suggestedEndDate ?? startDate
}

export function suggestedChangeDate(steps: CalculatedStep[], currentStep: number) {
  return steps.find((step) => step.stepNumber === currentStep + 1)?.suggestedStartDate ?? null
}

export function recalculateRemainingSteps(
  steps: Array<{ stepNumber: number; durationDays: number; suggestedStartDate: string; suggestedEndDate: string }>,
  currentStep: number,
  actualStartDate: string,
) {
  const completed = steps.filter((step) => step.stepNumber < currentStep)
  const remainingDurations = steps.filter((step) => step.stepNumber >= currentStep).map((step) => step.durationDays)
  const recalculated = calculateTreatmentSteps(actualStartDate, remainingDurations).map((step, index) => ({
    ...step,
    stepNumber: currentStep + index,
  }))
  return [...completed, ...recalculated]
}

export function addDaysToDate(date: string, days: number) {
  return formatDate(addDays(parseDate(date), days))
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00Z`)
}

function addDays(value: Date, days: number) {
  const result = new Date(value)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10)
}
