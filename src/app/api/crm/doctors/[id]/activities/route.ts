import { NextResponse } from 'next/server'
import { desc, eq, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { adminUsers, crmActivities, crmDoctors } from '@/lib/db/schema'
import { crmActivitySchema } from '@/lib/crm/crm'
import { firstIssue, getCrmDoctor, requireCrmAccess } from '@/lib/crm/server'

async function loadRecord(params: { id: string }) {
  const { access, error } = await requireCrmAccess()
  if (error) return { error }
  const id = Number(params.id)
  if (!Number.isSafeInteger(id) || id <= 0) return { error: NextResponse.json({ error: 'Invalid record' }, { status: 400 }) }
  const row = await getCrmDoctor(access, id)
  if (!row) return { error: NextResponse.json({ error: 'Record not found' }, { status: 404 }) }
  return { id, access }
}

function listActivities(id: number) {
  return getDb().select({
    id: crmActivities.id,
    kind: crmActivities.kind,
    body: crmActivities.body,
    createdAt: crmActivities.createdAt,
    authorName: sql<string | null>`coalesce(nullif(${adminUsers.fullName}, ''), ${adminUsers.username})`,
  }).from(crmActivities).leftJoin(adminUsers, eq(adminUsers.id, crmActivities.authorId))
    .where(eq(crmActivities.crmDoctorId, id)).orderBy(desc(crmActivities.createdAt), desc(crmActivities.id)).limit(200)
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const record = await loadRecord(params)
  if ('error' in record) return record.error
  return NextResponse.json({ activities: await listActivities(record.id) })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const record = await loadRecord(params)
  if ('error' in record) return record.error
  const parsed = crmActivitySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 })
  const db = getDb()
  await db.insert(crmActivities).values({ crmDoctorId: record.id, authorId: record.access.userId, ...parsed.data })
  await db.update(crmDoctors).set({ updatedAt: new Date() }).where(eq(crmDoctors.id, record.id))
  return NextResponse.json({ activities: await listActivities(record.id) }, { status: 201 })
}
