import { and, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { idesignCaseActivities, idesignCases } from '@/lib/db/schema'
import { getIDesignCaseAccessCondition } from './access'

export async function getAccessibleIDesignCase(caseId: number, userId: number, role: string) {
  const access = await getIDesignCaseAccessCondition(userId, role)
  const where = access ? and(eq(idesignCases.id, caseId), access) : eq(idesignCases.id, caseId)
  const [caseRow] = await getDb().select().from(idesignCases).where(where).limit(1)
  return caseRow ?? null
}

export async function recordIDesignActivity(input: {
  caseId: number
  eventType: string
  detail: string
  actorId?: number | null
  actorRole: string
  actorName: string
}) {
  await getDb().insert(idesignCaseActivities).values(input)
}

export async function persistIDesignSubmission<T extends { id: number }>(operations: {
  createCase: () => Promise<T>
  recordActivity: (created: T) => Promise<void>
  rollbackCase: (created: T) => Promise<void>
}) {
  const created = await operations.createCase()

  try {
    await operations.recordActivity(created)
  } catch (activityError) {
    try {
      await operations.rollbackCase(created)
    } catch (rollbackError) {
      throw new AggregateError([activityError, rollbackError], 'Unable to record or roll back the iDesign submission')
    }
    throw activityError
  }

  return created
}

export function sessionActor(session: { user: { id: string; role: string; name?: string | null; username: string } }) {
  return {
    actorId: Number(session.user.id),
    actorRole: session.user.role,
    actorName: session.user.name || session.user.username,
  }
}
