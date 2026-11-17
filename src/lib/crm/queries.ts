import { sql, type SQL } from 'drizzle-orm'
import type { CrmAccess } from './crm'

// Raw SQL builders for the CRM. Each is a single idempotent statement, so it is safe to run
// repeatedly (registration, assignment changes, page loads) and is tested against PGlite.

function ids(values: number[] | undefined) {
  return (values ?? []).filter((id) => Number.isSafeInteger(id) && id > 0)
}

function idList(values: number[]) {
  return sql.join(values.map((id) => sql`${id}`), sql`, `)
}

/** WHERE condition on crm_doctors (aliased as c) for the viewer's scope. */
export function crmScopeSql(access: CrmAccess, alias = 'c'): SQL {
  if (access.all) return sql`true`
  const salesIds = ids(access.salesIds)
  if (salesIds.length === 0) return sql`false`
  return sql`${sql.raw(alias)}.sales_id IN (${idList(salesIds)})`
}

export interface CrmLinkFilter {
  /** Only link rows to this doctor account (the registration hook). */
  doctorAccountId?: number
  /** Only link this CRM row (after a sales rep adds or edits a record). */
  crmId?: number
  /** Only link rows owned by these sales accounts (page-load back-fill). */
  salesIds?: number[]
}

/**
 * Links sales-added rows to the doctor account with the same email (case-insensitive).
 * A row is never linked when its owner already has a row for that account, so linking can
 * never create a duplicate; the existing row keeps its CRM data (status, notes, tags…).
 */
export function linkCrmByEmailQuery(filter: CrmLinkFilter = {}): SQL {
  const conditions: SQL[] = []
  if (filter.doctorAccountId !== undefined) conditions.push(sql`u.id = ${filter.doctorAccountId}`)
  if (filter.crmId !== undefined) conditions.push(sql`c.id = ${filter.crmId}`)
  if (filter.salesIds !== undefined) {
    const salesIds = ids(filter.salesIds)
    conditions.push(salesIds.length ? sql`c.sales_id IN (${idList(salesIds)})` : sql`false`)
  }
  const extra = conditions.length ? sql` AND ${sql.join(conditions, sql` AND `)}` : sql``
  return sql`UPDATE crm_doctors AS c
    SET doctor_account_id = u.id, updated_at = now()
    FROM (
      SELECT DISTINCT ON (lower(email)) id, email FROM admin_users
      WHERE role = 'doctor' AND email IS NOT NULL AND email <> ''
      ORDER BY lower(email), id
    ) AS u
    WHERE c.doctor_account_id IS NULL
      AND c.email IS NOT NULL
      AND lower(c.email) = lower(u.email)
      AND NOT EXISTS (SELECT 1 FROM crm_doctors x WHERE x.sales_id = c.sales_id AND x.doctor_account_id = u.id)${extra}
    RETURNING c.id, c.sales_id, c.doctor_account_id`
}

export interface CrmAssignmentFilter {
  salesIds?: number[]
  doctorIds?: number[]
}

/**
 * Creates a CRM row for every sales→doctor assignment that has none yet, copying the doctor's
 * registration data. Run it after linkCrmByEmailQuery so a sales-added row with the same email
 * is reused (merged) instead of duplicated.
 */
export function insertAssignedCrmQuery(filter: CrmAssignmentFilter = {}): SQL {
  const conditions: SQL[] = []
  if (filter.salesIds !== undefined) {
    const salesIds = ids(filter.salesIds)
    conditions.push(salesIds.length ? sql`a.sales_id IN (${idList(salesIds)})` : sql`false`)
  }
  if (filter.doctorIds !== undefined) {
    const doctorIds = ids(filter.doctorIds)
    conditions.push(doctorIds.length ? sql`a.doctor_id IN (${idList(doctorIds)})` : sql`false`)
  }
  const extra = conditions.length ? sql` AND ${sql.join(conditions, sql` AND `)}` : sql``
  return sql`INSERT INTO crm_doctors
      (sales_id, doctor_account_id, full_name, email, phone, clinic_name, country, city, address, status, source, created_at, updated_at)
    SELECT a.sales_id, u.id, coalesce(nullif(trim(u.full_name), ''), u.username), nullif(u.email, ''), u.phone, u.clinic_name, u.country, u.city, u.address,
      CASE WHEN EXISTS (SELECT 1 FROM orders o WHERE o.submitted_by = u.id)
        OR EXISTS (SELECT 1 FROM idesign_orders i WHERE i.doctor_account_id = u.id) THEN 'active' ELSE 'lead' END,
      'registered', now(), now()
    FROM sales_doctor_assignments a
    JOIN admin_users u ON u.id = a.doctor_id AND u.role = 'doctor'
    WHERE NOT EXISTS (SELECT 1 FROM crm_doctors c WHERE c.sales_id = a.sales_id AND c.doctor_account_id = a.doctor_id)${extra}
    ON CONFLICT DO NOTHING
    RETURNING id`
}
