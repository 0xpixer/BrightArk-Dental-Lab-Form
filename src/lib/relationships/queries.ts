import { sql, type SQL } from 'drizzle-orm'

// Raw SQL for doctor ↔ sales relationships. Each statement is idempotent and tested against PGlite.

function ids(values: number[]) {
  return [...new Set(values)].filter((id) => Number.isSafeInteger(id) && id > 0)
}

function idList(values: number[]) {
  return sql.join(values.map((id) => sql`${id}`), sql`, `)
}

/** Each doctor's sales rep: the earliest assignment (accounts only ever get one through this page). */
const PRIMARY_ASSIGNMENT = sql.raw(`(
  SELECT DISTINCT ON (doctor_id) doctor_id, sales_id FROM sales_doctor_assignments ORDER BY doctor_id, created_at, sales_id
)`)

/**
 * Order counts per doctor and sales value. A case and its Finance row are the same order, so
 * Finance rows tied to a case (case_id, or the case's imported record) are not counted twice.
 */
export function orderSalesLinksQuery(): SQL {
  return sql`SELECT doctor_id AS "doctorId", sales_id AS "salesId", count(*)::int AS count FROM (
      SELECT c.doctor_account_id AS doctor_id, c.sales_account_id AS sales_id FROM idesign_cases c WHERE c.doctor_account_id IS NOT NULL
      UNION ALL
      SELECT o.doctor_account_id, o.sales_account_id FROM idesign_orders o
      WHERE o.doctor_account_id IS NOT NULL AND o.case_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM idesign_cases c WHERE c.imported_order_id = o.id)
    ) AS links GROUP BY doctor_id, sales_id`
}

/** Removes every other sales rep of these doctors. */
export function clearDoctorSalesQuery(doctorIds: number[], keepSalesId: number | null): SQL {
  const doctors = ids(doctorIds)
  if (!doctors.length) return sql`SELECT 1 WHERE false`
  return sql`DELETE FROM sales_doctor_assignments WHERE doctor_id IN (${idList(doctors)})${keepSalesId ? sql` AND sales_id <> ${keepSalesId}` : sql``}`
}

/** Assigns these doctors to a sales account (skips non-doctor accounts). */
export function assignDoctorSalesQuery(doctorIds: number[], salesId: number, actorId: number | null, onlyUnassigned = false): SQL {
  const doctors = ids(doctorIds)
  if (!doctors.length) return sql`SELECT 1 WHERE false`
  return sql`INSERT INTO sales_doctor_assignments (sales_id, doctor_id, assigned_by)
    SELECT s.id, u.id, ${actorId} FROM admin_users u
    JOIN admin_users s ON s.id = ${salesId} AND s.role IN ('sales', 'sales_director')
    WHERE u.id IN (${idList(doctors)}) AND u.role = 'doctor'
      ${onlyUnassigned ? sql`AND NOT EXISTS (SELECT 1 FROM sales_doctor_assignments a WHERE a.doctor_id = u.id)` : sql``}
    ON CONFLICT DO NOTHING
    RETURNING doctor_id AS "doctorId", sales_id AS "salesId"`
}

/** Points these doctors' clear aligner cases at the doctor's sales rep. */
export function alignCaseSalesQuery(doctorIds: number[]): SQL {
  const doctors = ids(doctorIds)
  if (!doctors.length) return sql`SELECT 1 WHERE false`
  return sql`UPDATE idesign_cases AS c SET sales_account_id = a.sales_id, updated_at = now()
    FROM ${PRIMARY_ASSIGNMENT} AS a
    WHERE c.doctor_account_id = a.doctor_id AND c.doctor_account_id IN (${idList(doctors)})
      AND c.sales_account_id IS DISTINCT FROM a.sales_id
    RETURNING c.id`
}

/** Points these doctors' imported orders and Finance rows at the doctor's sales rep. */
export function alignOrderSalesQuery(doctorIds: number[], actorId: number | null): SQL {
  const doctors = ids(doctorIds)
  if (!doctors.length) return sql`SELECT 1 WHERE false`
  return sql`UPDATE idesign_orders AS o SET sales_account_id = a.sales_id,
      salesperson_name = coalesce(nullif(trim(s.full_name), ''), s.username),
      assignment_updated_by = ${actorId}, assignment_updated_at = now(), updated_at = now()
    FROM ${PRIMARY_ASSIGNMENT} AS a JOIN admin_users s ON s.id = a.sales_id
    WHERE o.doctor_account_id = a.doctor_id AND o.doctor_account_id IN (${idList(doctors)})
      AND o.sales_account_id IS DISTINCT FROM a.sales_id
    RETURNING o.id`
}
