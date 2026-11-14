import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { adminUsers, appSettings, idesignCases, idesignOrders, orders, salesDoctorAssignments } from '@/lib/db/schema'
import { isAdminRole, isDesignerRole, SALES_ROLES } from '@/lib/admin/roles'
import { getFinanceOverdueDays } from '@/lib/finance/server'
import { buildOverviewMetrics } from '@/lib/overviewMetrics'
import { latestOrderMessageAt, unreadLatestOrderMessageCondition } from '@/lib/orderUnread'
import { buildLabExtras } from '@/lib/overview/partner'
import {
  buildAdminAlignerOverview,
  buildAdminFinance,
  buildAdminLabOverview,
  parseSalesTargets,
  SALES_TARGETS_KEY,
  type AdminCaseInput,
  type AdminLabOrderInput,
} from '@/lib/overview/admin'

/**
 * Admin / superadmin / designer overview. Data volumes are small (hundreds of rows), so rows are
 * loaded once and the country / sales / doctor / category filters are applied in memory. That keeps
 * every panel, filter option and total on the same resolved country.
 */
export async function GET(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  const role = session!.user.role
  const designer = isDesignerRole(role)
  if (!isAdminRole(role) && !designer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const userId = Number(session!.user.id)
  const { searchParams } = new URL(request.url)
  const tab = !designer && searchParams.get('tab') === 'lab' ? 'lab' : 'aligners'
  const country = searchParams.get('country')?.trim() || ''
  const salesId = Number(searchParams.get('salesId')) || null
  const doctorId = Number(searchParams.get('doctorId')) || null
  const category = searchParams.get('category')?.trim() || ''
  const now = new Date()
  const db = getDb()

  const accounts = await db.select({ id: adminUsers.id, name: adminUsers.fullName, username: adminUsers.username, role: adminUsers.role, country: adminUsers.country, isActive: adminUsers.isActive }).from(adminUsers)
  const accountById = new Map(accounts.map((account) => [account.id, { ...account, label: account.name || account.username }]))
  const salesAccounts = accounts
    .filter((account) => (SALES_ROLES as readonly string[]).includes(account.role) && account.isActive)
    .map((account) => ({ id: account.id, name: account.name || account.username, country: account.country }))
    .sort((left, right) => left.name.localeCompare(right.name))
  const salesInCountry = salesAccounts.filter((account) => !country || account.country === country)
  const accountCountries = accounts.filter((account) => account.role === 'doctor' || (SALES_ROLES as readonly string[]).includes(account.role)).map((account) => account.country)
  const countryOptions = (extra: Array<string | null>) => [...new Set([...accountCountries, ...extra].filter((value): value is string => Boolean(value)))].sort()

  const base = {
    tab,
    canSeeLab: !designer,
    canSeeFinance: !designer,
    canManageTargets: isAdminRole(role),
    filters: { country, salesId, doctorId, category },
    generatedAt: now.toISOString(),
  }

  if (tab === 'aligners') {
    const [caseRows, financeRows, targetRow, overdueDays] = await Promise.all([
      db.select({
        id: idesignCases.id,
        orderNo: idesignCases.orderNo,
        patientName: idesignCases.patientName,
        latestProgress: idesignCases.latestProgress,
        createdAt: idesignCases.createdAt,
        updatedAt: idesignCases.updatedAt,
        doctorAccountId: idesignCases.doctorAccountId,
        salesAccountId: idesignCases.salesAccountId,
        sourceCreatedOn: idesignOrders.sourceCreatedOn,
        sourceUpdatedOn: idesignOrders.sourceUpdatedOn,
        sourceDoctorName: idesignOrders.doctorName,
        sourceSalesName: idesignOrders.salespersonName,
        sourceCountry: idesignOrders.country,
        category: idesignOrders.category,
      }).from(idesignCases).leftJoin(idesignOrders, eq(idesignOrders.id, idesignCases.importedOrderId)),
      designer ? Promise.resolve([]) : db.select({
        paymentStatus: idesignOrders.paymentStatus,
        dueDate: idesignOrders.dueDate,
        invoiceDate: idesignOrders.invoiceDate,
        originalPrice: idesignOrders.originalPrice,
        discount: idesignOrders.discount,
        totalAmount: idesignOrders.totalAmount,
        currency: idesignOrders.originalCurrency,
        category: idesignOrders.category,
        doctorAccountId: idesignOrders.doctorAccountId,
        salesAccountId: idesignOrders.salesAccountId,
        sourceCountry: idesignOrders.country,
      }).from(idesignOrders),
      db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, SALES_TARGETS_KEY)).limit(1),
      getFinanceOverdueDays(),
    ])

    // A case belongs to its doctor's country; imported rows fall back to the spreadsheet country, then the sales account.
    const resolveCountry = (doctor: number | null, sales: number | null, source: string | null) =>
      (doctor ? accountById.get(doctor)?.country : null) || source || (sales ? accountById.get(sales)?.country : null) || null

    const allCases = caseRows.map((row) => {
      const updated = row.updatedAt.toISOString()
      return {
        id: row.id,
        orderNo: row.orderNo,
        patientName: row.patientName,
        latestProgress: row.latestProgress,
        createdOn: row.sourceCreatedOn ?? row.createdAt.toISOString().slice(0, 10),
        updatedAt: row.sourceUpdatedOn && row.sourceUpdatedOn > updated.slice(0, 10) ? `${row.sourceUpdatedOn}T00:00:00.000Z` : updated,
        doctorAccountId: row.doctorAccountId,
        doctorName: (row.doctorAccountId ? accountById.get(row.doctorAccountId)?.label : null) ?? row.sourceDoctorName ?? null,
        salesAccountId: row.salesAccountId,
        salesName: (row.salesAccountId ? accountById.get(row.salesAccountId)?.label : null) ?? row.sourceSalesName ?? null,
        category: row.category ?? 'iAlign',
        country: resolveCountry(row.doctorAccountId, row.salesAccountId, row.sourceCountry),
      }
    })
    const countries = countryOptions(allCases.map((row) => row.country))
    const inCountry = allCases.filter((row) => !country || row.country === country)
    const doctorOptions = uniqueDoctors(inCountry.filter((row) => !salesId || row.salesAccountId === salesId))
    const cases: AdminCaseInput[] = inCountry.filter((row) =>
      (!salesId || row.salesAccountId === salesId)
      && (!doctorId || row.doctorAccountId === doctorId)
      && (!category || row.category === category))

    // Sales shown in targets: everyone in the selected country, plus anyone with cases in the filtered set.
    const salesWithCases = new Set(cases.map((row) => row.salesAccountId))
    const leaderboardSales = salesAccounts.filter((account) => (salesId ? account.id === salesId : (!country || account.country === country || salesWithCases.has(account.id))))
    const targets = parseSalesTargets(targetRow[0]?.value)

    const finance = designer ? null : buildAdminFinance(financeRows.filter((row) =>
      row.category !== 'Dental Lab'
      && (!category || row.category === category)
      && (!country || resolveCountry(row.doctorAccountId, row.salesAccountId, row.sourceCountry) === country)
      && (!salesId || row.salesAccountId === salesId)
      && (!doctorId || row.doctorAccountId === doctorId)), overdueDays, now.toISOString().slice(0, 10))

    return NextResponse.json({
      ...base,
      options: { countries, sales: salesInCountry.map(({ id, name }) => ({ id, name })), doctors: doctorOptions, categories: [...new Set(allCases.map((row) => row.category))].sort() },
      aligners: buildAdminAlignerOverview(cases, leaderboardSales, designer ? {} : targets, now),
      finance,
      allTargets: isAdminRole(role) ? salesAccounts.map((account) => ({ id: account.id, name: account.name, country: account.country, target: targets[account.id] ?? 0 })) : [],
    })
  }

  // ---------- Dental Lab ----------
  const [orderRows, assignments, financeRows, overdueDays, unread] = await Promise.all([
    db.select({ id: orders.id, orderNo: orders.orderNo, patientName: orders.patientName, status: orders.status, treatmentType: orders.treatmentType, createdAt: orders.createdAt, statusUpdatedAt: orders.statusUpdatedAt, submittedBy: orders.submittedBy, dentist: orders.dentist }).from(orders),
    db.select({ salesId: salesDoctorAssignments.salesId, doctorId: salesDoctorAssignments.doctorId }).from(salesDoctorAssignments),
    db.select({
      paymentStatus: idesignOrders.paymentStatus,
      dueDate: idesignOrders.dueDate,
      invoiceDate: idesignOrders.invoiceDate,
      originalPrice: idesignOrders.originalPrice,
      discount: idesignOrders.discount,
      totalAmount: idesignOrders.totalAmount,
      currency: idesignOrders.originalCurrency,
      doctorAccountId: idesignOrders.doctorAccountId,
      salesAccountId: idesignOrders.salesAccountId,
      sourceCountry: idesignOrders.country,
    }).from(idesignOrders).where(eq(idesignOrders.category, 'Dental Lab')),
    getFinanceOverdueDays(),
    (async () => {
      const latestMessageAt = latestOrderMessageAt()
      return db.select({ orderId: orders.id, orderNo: orders.orderNo, patientName: orders.patientName, latestMessageAt }).from(orders).where(unreadLatestOrderMessageCondition(userId)).orderBy(desc(latestMessageAt)).limit(50)
    })(),
  ])
  const salesByDoctor = new Map<number, number[]>()
  for (const row of assignments) salesByDoctor.set(row.doctorId, [...(salesByDoctor.get(row.doctorId) ?? []), row.salesId])

  const allOrders = orderRows.map((row) => {
    const doctor = row.submittedBy ? accountById.get(row.submittedBy) : null
    return {
      id: row.id,
      orderNo: row.orderNo,
      patientName: row.patientName,
      status: row.status,
      treatmentType: row.treatmentType,
      createdAt: row.createdAt.toISOString(),
      statusUpdatedAt: row.statusUpdatedAt.toISOString(),
      doctorId: doctor?.role === 'doctor' ? doctor.id : null,
      doctorName: doctor?.role === 'doctor' ? doctor.label : row.dentist,
      salesIds: row.submittedBy ? salesByDoctor.get(row.submittedBy) ?? [] : [],
      country: doctor?.country ?? (row.submittedBy ? (salesByDoctor.get(row.submittedBy) ?? []).map((id) => accountById.get(id)?.country).find(Boolean) ?? null : null),
    }
  })
  const countries = countryOptions(allOrders.map((row) => row.country))
  const inCountry = allOrders.filter((row) => !country || row.country === country)
  const labRows: AdminLabOrderInput[] = inCountry.filter((row) => (!salesId || row.salesIds.includes(salesId)) && (!doctorId || row.doctorId === doctorId))
  const scopedIds = new Set(labRows.map((row) => row.id))
  const doctorOptions = [...new Map(inCountry.filter((row) => row.doctorId && (!salesId || row.salesIds.includes(salesId))).map((row) => [row.doctorId!, { id: row.doctorId!, name: row.doctorName ?? 'Doctor' }])).values()].sort((left, right) => left.name.localeCompare(right.name))
  const financeCountry = (row: (typeof financeRows)[number]) => (row.doctorAccountId ? accountById.get(row.doctorAccountId)?.country : null) || row.sourceCountry || null

  return NextResponse.json({
    ...base,
    options: { countries, sales: salesInCountry.map(({ id, name }) => ({ id, name })), doctors: doctorOptions, categories: [] },
    lab: {
      metrics: buildOverviewMetrics(labRows, 'month', now),
      ...buildLabExtras(labRows.map((row) => ({ ...row, submittedBy: row.doctorId }))),
      ...buildAdminLabOverview(labRows, salesInCountry, now),
      newMessages: unread.filter((row) => scopedIds.has(row.orderId)).slice(0, 8),
    },
    finance: buildAdminFinance(financeRows.filter((row) =>
      (!country || financeCountry(row) === country)
      && (!salesId || row.salesAccountId === salesId)
      && (!doctorId || row.doctorAccountId === doctorId)), overdueDays, now.toISOString().slice(0, 10)),
  })
}

function uniqueDoctors(rows: Array<{ doctorAccountId: number | null; doctorName: string | null }>) {
  const map = new Map<number, { id: number; name: string }>()
  for (const row of rows) if (row.doctorAccountId) map.set(row.doctorAccountId, { id: row.doctorAccountId, name: row.doctorName ?? 'Doctor' })
  return [...map.values()].sort((left, right) => left.name.localeCompare(right.name))
}

