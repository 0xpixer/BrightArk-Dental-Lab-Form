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

/**
 * Account-linked rows whose owner is no longer assigned to the doctor ("orphans"), each paired with the
 * row of the doctor's current (earliest-assigned) rep. Happens when a doctor is moved to another rep:
 * the sync creates the new rep's row and the old one would otherwise linger as a duplicate.
 * Pairs whose move would clash with another of the new rep's rows (same email) are skipped.
 */
export function crmOrphanPairsQuery(): SQL {
  return sql`SELECT DISTINCT ON (o.id) o.id AS "orphanId", d.id AS "keepId", d.sales_id AS "salesId"
    FROM crm_doctors o
    JOIN crm_doctors d ON d.doctor_account_id = o.doctor_account_id AND d.id <> o.id
    JOIN sales_doctor_assignments a ON a.sales_id = d.sales_id AND a.doctor_id = d.doctor_account_id
    WHERE o.doctor_account_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM sales_doctor_assignments x WHERE x.sales_id = o.sales_id AND x.doctor_id = o.doctor_account_id)
      AND NOT EXISTS (
        SELECT 1 FROM crm_doctors e
        WHERE e.sales_id = d.sales_id AND e.id NOT IN (o.id, d.id) AND o.email IS NOT NULL AND lower(e.email) = lower(o.email)
      )
    ORDER BY o.id, a.created_at, d.id`
}

/**
 * Folds the orphan into the current rep's row: the orphan's id (and so its history) survives, CRM fields
 * take the most recently edited non-empty value, notes are combined and tags united, activities move over.
 * Run in order; every step is safe to repeat if a later one fails.
 */
export function mergeCrmPairQueries(orphanId: number, keepId: number, salesId: number): SQL[] {
  // The current rep's row only counts as "newer" once someone edited it; a row the sync just created
  // (updated_at = created_at) must never overwrite the old record's real data with defaults.
  const keepEdited = 'k.updated_at > k.created_at + interval \'1 second\' AND k.updated_at > o.updated_at'
  const newer = (column: string) => sql.raw(`CASE WHEN ${keepEdited} THEN coalesce(k.${column}, o.${column}) ELSE coalesce(o.${column}, k.${column}) END`)
  return [
    sql`UPDATE crm_doctors AS o SET
        full_name = ${newer('full_name')}, email = ${newer('email')}, phone = ${newer('phone')}, clinic_name = ${newer('clinic_name')},
        country = ${newer('country')}, city = ${newer('city')}, address = ${newer('address')}, specialty = ${newer('specialty')},
        avatar_url = ${newer('avatar_url')}, account_type = ${newer('account_type')}, next_follow_up = ${newer('next_follow_up')},
        status = CASE WHEN ${sql.raw(keepEdited)} THEN k.status ELSE o.status END,
        notes = CASE WHEN nullif(trim(o.notes), '') IS NULL THEN k.notes WHEN nullif(trim(k.notes), '') IS NULL OR k.notes = o.notes THEN o.notes ELSE o.notes || E'\n\n' || k.notes END,
        tags = (SELECT coalesce(jsonb_agg(DISTINCT t), '[]'::jsonb) FROM (
          SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(o.tags) = 'array' THEN o.tags ELSE '[]'::jsonb END)
          UNION SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(k.tags) = 'array' THEN k.tags ELSE '[]'::jsonb END)
        ) AS merged(t)),
        contract_url = CASE WHEN o.contract_url IS NULL OR (k.contract_url IS NOT NULL AND k.contract_uploaded_at > o.contract_uploaded_at) THEN k.contract_url ELSE o.contract_url END,
        contract_file_name = CASE WHEN o.contract_url IS NULL OR (k.contract_url IS NOT NULL AND k.contract_uploaded_at > o.contract_uploaded_at) THEN k.contract_file_name ELSE o.contract_file_name END,
        contract_uploaded_at = CASE WHEN o.contract_url IS NULL OR (k.contract_url IS NOT NULL AND k.contract_uploaded_at > o.contract_uploaded_at) THEN k.contract_uploaded_at ELSE o.contract_uploaded_at END,
        updated_at = greatest(o.updated_at, k.updated_at)
      FROM crm_doctors AS k
      WHERE o.id = ${orphanId} AND k.id = ${keepId} AND k.doctor_account_id = o.doctor_account_id`,
    sql`UPDATE crm_activities SET crm_doctor_id = ${orphanId}
      WHERE crm_doctor_id = ${keepId} AND EXISTS (SELECT 1 FROM crm_doctors WHERE id = ${orphanId})`,
    sql`DELETE FROM crm_doctors WHERE id = ${keepId} AND EXISTS (SELECT 1 FROM crm_doctors WHERE id = ${orphanId})`,
    sql`UPDATE crm_doctors SET sales_id = ${salesId}
      WHERE id = ${orphanId}
        AND NOT EXISTS (SELECT 1 FROM crm_doctors x WHERE x.sales_id = ${salesId} AND x.doctor_account_id = crm_doctors.doctor_account_id)`,
  ]
}
