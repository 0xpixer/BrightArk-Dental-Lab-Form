import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { requireSession } from '@/lib/admin/session'
import { getDb } from '@/lib/db/client'
import { idesignOrders } from '@/lib/db/schema'
import { canViewFinance } from '@/lib/finance/finance'
import { getFinanceScope } from '@/lib/finance/server'

/** Scoped invoice download: the row must be inside the caller's finance scope. */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const { session, error } = await requireSession()
  if (error) return error
  const role = session!.user.role
  if (!canViewFinance(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = Number(params.id)
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const scope = await getFinanceScope(Number(session!.user.id), role)
  const [row] = await getDb().select({ url: idesignOrders.invoiceFileUrl })
    .from(idesignOrders)
    .where(and(eq(idesignOrders.id, id), scope))
    .limit(1)
  if (!row?.url) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  return NextResponse.redirect(row.url, { status: 302 })
}
