import { and, eq, inArray, isNotNull, ne, or, isNull, sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db/client'
import { adminUsers, alignerProduction, idesignCases, idesignOrders } from '@/lib/db/schema'
import { accountEmail, appLink, sendTransactionalEmail } from '@/lib/email'
import { batchLabel, isProductionReminderDue, nextProductionDue, PRODUCTION_INTERVAL_DAYS, RETAINER_BATCH } from '@/lib/idesign/production'
import { productionToday } from '@/lib/idesign/productionServer'

/**
 * Daily: email every active Superadmin and the order's sales rep when a clear aligner order's next
 * batch is due for production (current batch delivered + 80 days). Once per order per batch.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const today = productionToday()
  const candidates = await db.select({
    caseId: alignerProduction.caseId,
    totalStages: alignerProduction.totalStages,
    deliveredBatch: alignerProduction.deliveredBatch,
    batchDeliveredOn: alignerProduction.batchDeliveredOn,
    notifiedBatch: alignerProduction.notifiedBatch,
    orderNo: idesignCases.orderNo,
    patientName: idesignCases.patientName,
    salesAccountId: idesignCases.salesAccountId,
    doctorAccountId: idesignCases.doctorAccountId,
    importedDoctorName: idesignOrders.doctorName,
  }).from(alignerProduction)
    .innerJoin(idesignCases, eq(idesignCases.id, alignerProduction.caseId))
    .leftJoin(idesignOrders, eq(idesignOrders.id, idesignCases.importedOrderId))
    .where(and(
      isNotNull(alignerProduction.deliveredBatch),
      ne(alignerProduction.deliveredBatch, RETAINER_BATCH),
      isNotNull(alignerProduction.batchDeliveredOn),
      sql`(${alignerProduction.batchDeliveredOn} + ${PRODUCTION_INTERVAL_DAYS}::int)::date <= ${today}::date`,
      or(isNull(alignerProduction.notifiedBatch), sql`${alignerProduction.notifiedBatch} <> ${alignerProduction.deliveredBatch}`),
      ne(idesignCases.latestProgress, 'Canceled'),
    ))
  const due = candidates.filter((row) => isProductionReminderDue(row, today))
  if (due.length === 0) return NextResponse.json({ success: true, due: 0, emailsSent: 0, date: today })

  const accountIds = [...new Set(due.flatMap((row) => [row.salesAccountId, row.doctorAccountId]).filter((id): id is number => Boolean(id)))]
  const [superadmins, accounts] = await Promise.all([
    db.select({ email: adminUsers.email, username: adminUsers.username }).from(adminUsers)
      .where(and(eq(adminUsers.role, 'superadmin'), eq(adminUsers.isActive, true))),
    accountIds.length
      ? db.select({ id: adminUsers.id, email: adminUsers.email, username: adminUsers.username, fullName: adminUsers.fullName, isActive: adminUsers.isActive })
        .from(adminUsers).where(inArray(adminUsers.id, accountIds))
      : Promise.resolve([]),
  ])
  const accountsById = new Map(accounts.map((account) => [account.id, account]))
  const superadminEmails = superadmins.map(accountEmail).filter((email): email is string => Boolean(email))
  const link = appLink('/admin/idesign/production')

  let emailsSent = 0
  let notified = 0
  for (const row of due) {
    // Claim the reminder first so overlapping runs cannot send it twice.
    const claimed = await db.update(alignerProduction)
      .set({ notifiedBatch: row.deliveredBatch, notifiedAt: new Date() })
      .where(and(
        eq(alignerProduction.caseId, row.caseId),
        eq(alignerProduction.deliveredBatch, row.deliveredBatch!),
        or(isNull(alignerProduction.notifiedBatch), ne(alignerProduction.notifiedBatch, row.deliveredBatch!)),
      ))
      .returning({ caseId: alignerProduction.caseId })
    if (claimed.length === 0) continue

    const salesAccount = row.salesAccountId ? accountsById.get(row.salesAccountId) : undefined
    const salesEmail = salesAccount?.isActive ? accountEmail(salesAccount) : null
    const recipients = [...new Set([...superadminEmails, ...(salesEmail ? [salesEmail] : [])].map((email) => email.toLowerCase()))]
    const doctor = row.doctorAccountId ? accountsById.get(row.doctorAccountId) : undefined
    const doctorName = doctor?.fullName || doctor?.username || row.importedDoctorName || '-'
    const current = batchLabel(row.deliveredBatch!, row.totalStages)
    const subject = `Aligner production due: ${row.patientName} (${row.orderNo})`
    const text = [
      'The next aligner batch for this order is due for production.',
      '',
      `Patient: ${row.patientName}`,
      `Order: ${row.orderNo}`,
      `Doctor: ${doctorName}`,
      `Total stages: ${row.totalStages ?? 'not set'}`,
      `Delivered stages: ${current} on ${row.batchDeliveredOn}`,
      `Next production due: ${nextProductionDue(row.deliveredBatch, row.batchDeliveredOn)}`,
      ...(link ? ['', `Open the production tracker: ${link}`] : []),
    ].join('\n')

    const results = await Promise.all(recipients.map((to) => sendTransactionalEmail({ to, subject, text })))
    const sent = results.filter(Boolean).length
    if (sent === 0) {
      // Nothing went out (email not configured or failed): release the claim so tomorrow's run tries again.
      await db.update(alignerProduction).set({ notifiedBatch: row.notifiedBatch, notifiedAt: null })
        .where(and(eq(alignerProduction.caseId, row.caseId), eq(alignerProduction.notifiedBatch, row.deliveredBatch!)))
      continue
    }
    emailsSent += sent
    notified += 1
  }

  return NextResponse.json({ success: true, due: due.length, notified, emailsSent, date: today })
}
