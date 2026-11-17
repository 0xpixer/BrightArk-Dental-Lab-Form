import { and, asc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import { alias, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { getDb } from '@/lib/db/client'
import { adminUsers, crmDoctors, idesignOrders, orders } from '@/lib/db/schema'
import { getSalesScopeIds } from '@/lib/sales/access'
import { requireSession } from '@/lib/admin/session'
import { IDESIGN_CLOSED_PROGRESS } from '@/lib/idesign/orders'
import { ORDER_TERMINAL_STATUSES } from '@/lib/orderStatus'
import { displayFinanceTotal } from '@/lib/finance/calc'
import { buildCrmAccess, canViewCrm, crmFieldAccess, sumByCurrency, type CrmAccess, type MoneyTotal } from './crm'
import { crmScopeSql } from './queries'
export { syncCrm } from './hooks'

export async function getCrmAccess(userId: number, role: string): Promise<CrmAccess | null> {
  if (!canViewCrm(role)) return null
  const salesScopeIds = role === 'sales_director' ? await getSalesScopeIds(userId) : [userId]
  return buildCrmAccess(userId, role, salesScopeIds)
}

const account = alias(adminUsers, 'crm_account')
const owner = alias(adminUsers, 'crm_owner')

const assignedSql = sql<boolean>`(${crmDoctors.doctorAccountId} IS NOT NULL AND EXISTS (
  SELECT 1 FROM sales_doctor_assignments sda WHERE sda.sales_id = ${crmDoctors.salesId} AND sda.doctor_id = ${crmDoctors.doctorAccountId}
))`

/** Mirrored value: the account's value while the owner is assigned to the doctor, otherwise the CRM's own. */
function effective(crmColumn: AnyPgColumn, accountColumn: AnyPgColumn) {
  return sql<string | null>`CASE WHEN ${assignedSql} AND ${account.id} IS NOT NULL THEN coalesce(nullif(${accountColumn}, ''), ${crmColumn}) ELSE ${crmColumn} END`
}

const selection = {
  id: crmDoctors.id,
  salesId: crmDoctors.salesId,
  ownerName: sql<string>`coalesce(nullif(${owner.fullName}, ''), ${owner.username})`,
  doctorAccountId: crmDoctors.doctorAccountId,
  accountActive: account.isActive,
  assigned: assignedSql,
  fullName: effective(crmDoctors.fullName, account.fullName),
  email: effective(crmDoctors.email, account.email),
  phone: effective(crmDoctors.phone, account.phone),
  clinicName: effective(crmDoctors.clinicName, account.clinicName),
  country: effective(crmDoctors.country, account.country),
  city: effective(crmDoctors.city, account.city),
  address: effective(crmDoctors.address, account.address),
  specialty: crmDoctors.specialty,
  status: crmDoctors.status,
  source: crmDoctors.source,
  nextFollowUp: crmDoctors.nextFollowUp,
  notes: crmDoctors.notes,
  tags: crmDoctors.tags,
  createdAt: crmDoctors.createdAt,
  updatedAt: crmDoctors.updatedAt,
}

function baseQuery() {
  return getDb().select(selection).from(crmDoctors)
    .innerJoin(owner, eq(owner.id, crmDoctors.salesId))
    .leftJoin(account, eq(account.id, crmDoctors.doctorAccountId))
}

export interface CrmListFilters {
  search?: string
  status?: string
  country?: string
  salesId?: number
  followUp?: string
  today: string
}

export const CRM_LIST_LIMIT = 500

export async function listCrmDoctors(access: CrmAccess, filters: CrmListFilters) {
  const conditions: SQL[] = [crmScopeSql(access, 'crm_doctors')]
  if (filters.search) {
    const pattern = `%${filters.search}%`
    conditions.push(or(
      ilike(selection.fullName, pattern), ilike(selection.email, pattern), ilike(selection.phone, pattern),
      ilike(selection.clinicName, pattern), ilike(selection.city, pattern), ilike(crmDoctors.specialty, pattern),
      ilike(crmDoctors.notes, pattern), sql`${crmDoctors.tags}::text ILIKE ${pattern}`,
    )!)
  }
  if (filters.status) conditions.push(eq(crmDoctors.status, filters.status))
  if (filters.country) conditions.push(sql`${selection.country} = ${filters.country}`)
  if (filters.salesId) conditions.push(eq(crmDoctors.salesId, filters.salesId))
  if (filters.followUp === 'due') conditions.push(sql`${crmDoctors.nextFollowUp} <= ${filters.today}::date`)
  if (filters.followUp === 'overdue') conditions.push(sql`${crmDoctors.nextFollowUp} < ${filters.today}::date`)
  if (filters.followUp === 'week') conditions.push(sql`${crmDoctors.nextFollowUp} BETWEEN ${filters.today}::date AND ${filters.today}::date + 7`)
  if (filters.followUp === 'none') conditions.push(isNull(crmDoctors.nextFollowUp))

  const rows = await baseQuery().where(and(...conditions))
    .orderBy(sql`${crmDoctors.nextFollowUp} ASC NULLS LAST`, asc(sql`lower(${selection.fullName})`), asc(crmDoctors.id))
    .limit(CRM_LIST_LIMIT + 1)
  return { rows: rows.slice(0, CRM_LIST_LIMIT), truncated: rows.length > CRM_LIST_LIMIT }
}

export type CrmRow = Awaited<ReturnType<typeof listCrmDoctors>>['rows'][number]

export async function getCrmDoctor(access: CrmAccess, id: number) {
  const [row] = await baseQuery().where(and(eq(crmDoctors.id, id), crmScopeSql(access, 'crm_doctors'))).limit(1)
  return row ?? null
}

export async function getCrmCountries(access: CrmAccess) {
  const rows = await getDb().selectDistinct({ country: selection.country }).from(crmDoctors)
    .innerJoin(owner, eq(owner.id, crmDoctors.salesId))
    .leftJoin(account, eq(account.id, crmDoctors.doctorAccountId))
    .where(crmScopeSql(access, 'crm_doctors'))
  return rows.map((row) => row.country).filter((country): country is string => Boolean(country)).sort()
}

/** Sales reps the viewer can file records under. */
export async function getCrmOwnerOptions(access: CrmAccess) {
  const conditions: SQL[] = [inArray(adminUsers.role, ['sales', 'sales_director']), eq(adminUsers.isActive, true)]
  if (!access.all) conditions.push(access.salesIds.length ? inArray(adminUsers.id, access.salesIds) : sql`false`)
  const rows = await getDb().select({ id: adminUsers.id, fullName: adminUsers.fullName, username: adminUsers.username })
    .from(adminUsers).where(and(...conditions)).orderBy(asc(adminUsers.fullName), asc(adminUsers.username))
  return rows.map((row) => ({ id: row.id, name: row.fullName || row.username }))
}

export interface CrmDoctorStats { activeCases: number; lastOrderDate: string | null; unpaid: MoneyTotal[] }

/** Order stats for linked doctors, from Dental Lab orders and iDesign (clear aligner) orders. */
export async function getCrmDoctorStats(doctorIds: number[]): Promise<Map<number, CrmDoctorStats>> {
  const idsToLoad = [...new Set(doctorIds)].filter((id) => Number.isSafeInteger(id) && id > 0)
  const stats = new Map<number, CrmDoctorStats>()
  if (idsToLoad.length === 0) return stats
  const db = getDb()
  const [lab, aligner, unpaid] = await Promise.all([
    db.select({
      doctorId: orders.submittedBy,
      active: sql<number>`count(*) FILTER (WHERE ${orders.status} NOT IN (${sql.join(ORDER_TERMINAL_STATUSES.map((status) => sql`${status}`), sql`, `)}))`.mapWith(Number),
      last: sql<string | null>`to_char(max(${orders.createdAt}) AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
    }).from(orders).where(inArray(orders.submittedBy, idsToLoad)).groupBy(orders.submittedBy),
    db.select({
      doctorId: idesignOrders.doctorAccountId,
      active: sql<number>`count(*) FILTER (WHERE ${idesignOrders.latestProgress} NOT IN (${sql.join(IDESIGN_CLOSED_PROGRESS.map((status) => sql`${status}`), sql`, `)}))`.mapWith(Number),
      last: sql<string | null>`to_char(max(coalesce(${idesignOrders.sourceCreatedOn}, (${idesignOrders.createdAt} AT TIME ZONE 'UTC')::date)), 'YYYY-MM-DD')`,
    }).from(idesignOrders).where(inArray(idesignOrders.doctorAccountId, idsToLoad)).groupBy(idesignOrders.doctorAccountId),
    db.select({
      doctorId: idesignOrders.doctorAccountId,
      originalPrice: idesignOrders.originalPrice,
      discount: idesignOrders.discount,
      totalAmount: idesignOrders.totalAmount,
      currency: sql<string | null>`coalesce(${idesignOrders.originalCurrency}, ${idesignOrders.paymentCurrency})`,
    }).from(idesignOrders).where(and(inArray(idesignOrders.doctorAccountId, idsToLoad), eq(idesignOrders.paymentStatus, 'Unpaid'))),
  ])
  const entry = (id: number) => {
    let value = stats.get(id)
    if (!value) stats.set(id, value = { activeCases: 0, lastOrderDate: null, unpaid: [] })
    return value
  }
  for (const row of [...lab, ...aligner]) {
    if (!row.doctorId) continue
    const value = entry(row.doctorId)
    value.activeCases += row.active
    if (row.last && (!value.lastOrderDate || row.last > value.lastOrderDate)) value.lastOrderDate = row.last
  }
  const unpaidByDoctor = new Map<number, { currency: string | null; amount: number | null }[]>()
  for (const row of unpaid) {
    if (!row.doctorId) continue
    const list = unpaidByDoctor.get(row.doctorId) ?? []
    list.push({ currency: row.currency, amount: displayFinanceTotal(row) })
    unpaidByDoctor.set(row.doctorId, list)
  }
  for (const [doctorId, list] of unpaidByDoctor) entry(doctorId).unpaid = sumByCurrency(list)
  return stats
}

/** Shape sent to the browser; stats only for doctors the record's owner is assigned to (or for Superadmin). */
export function serializeCrmRow(row: CrmRow, access: CrmAccess, stats: Map<number, CrmDoctorStats>) {
  const showStats = Boolean(row.doctorAccountId) && (row.assigned || access.all)
  return {
    ...row,
    tags: Array.isArray(row.tags) ? row.tags : [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    fieldAccess: crmFieldAccess(row),
    stats: showStats ? stats.get(row.doctorAccountId!) ?? { activeCases: 0, lastOrderDate: null, unpaid: [] } : null,
  }
}

export async function serializeCrmRows(rows: CrmRow[], access: CrmAccess) {
  const stats = await getCrmDoctorStats(rows.filter((row) => row.doctorAccountId && (row.assigned || access.all)).map((row) => row.doctorAccountId!))
  return rows.map((row) => serializeCrmRow(row, access, stats))
}

export interface CrmEmailMatch { id: number; ownerName: string; fullName: string; sameOwner: boolean }

/** Duplicate-email check: matches in the viewer's scope, a count outside it, and any registered doctor account. */
export async function checkCrmEmail(access: CrmAccess, email: string, salesId: number | null, excludeId: number | null) {
  const db = getDb()
  const matches = await db.select({ id: crmDoctors.id, salesId: crmDoctors.salesId, fullName: crmDoctors.fullName, ownerName: sql<string>`coalesce(nullif(${owner.fullName}, ''), ${owner.username})` })
    .from(crmDoctors).innerJoin(owner, eq(owner.id, crmDoctors.salesId))
    .where(and(sql`lower(${crmDoctors.email}) = ${email}`, excludeId ? sql`${crmDoctors.id} <> ${excludeId}` : undefined))
  const [registered] = await db.select({ id: adminUsers.id, fullName: adminUsers.fullName })
    .from(adminUsers).where(and(sql`lower(${adminUsers.email}) = ${email}`, eq(adminUsers.role, 'doctor'))).limit(1)
  const visible = matches.filter((match) => access.all || access.salesIds.includes(match.salesId))
  return {
    inScope: visible.map((match): CrmEmailMatch => ({ id: match.id, ownerName: match.ownerName, fullName: match.fullName, sameOwner: match.salesId === salesId })),
    otherCount: matches.length - visible.length,
    registered: registered ? { name: registered.fullName } : null,
  }
}

export function isUniqueViolation(error: unknown) {
  const candidate = error as { code?: string; message?: string; cause?: { code?: string } } | null
  return candidate?.code === '23505' || candidate?.cause?.code === '23505' || /duplicate key/i.test(candidate?.message ?? '')
}

/** Route guard: the signed-in user's CRM scope, or a 401/403 response. */
export async function requireCrmAccess(): Promise<{ access: CrmAccess; error: null } | { access: null; error: Response }> {
  const { session, error } = await requireSession()
  if (error) return { access: null, error }
  const access = await getCrmAccess(Number(session!.user.id), session!.user.role)
  if (!access) return { access: null, error: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  return { access, error: null }
}

/** Resolves the sales rep a record is filed under, enforcing the viewer's scope. */
export async function resolveCrmOwner(access: CrmAccess, requested: number | undefined): Promise<{ salesId: number } | { error: string; status: number }> {
  if (access.role === 'sales') {
    if (requested !== undefined && requested !== access.userId) return { error: 'You can only manage your own doctors', status: 403 }
    return { salesId: access.userId }
  }
  const salesId = requested ?? (access.all ? undefined : access.userId)
  if (salesId === undefined) return { error: 'Choose a sales rep for this doctor', status: 400 }
  const options = await getCrmOwnerOptions(access)
  if (!options.some((option) => option.id === salesId)) return { error: 'That sales rep is not in your team', status: 403 }
  return { salesId }
}

export function firstIssue(error: { issues: { path: (string | number)[]; message: string }[] }) {
  const issue = error.issues[0]
  return issue ? issue.message : 'Invalid input'
}
