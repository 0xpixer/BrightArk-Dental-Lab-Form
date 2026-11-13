import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/admin/session'
import { canManageFinance } from '@/lib/finance/finance'
import { setFinanceOverdueDays } from '@/lib/finance/server'

export async function PUT(request: Request) {
  const { session, error } = await requireSession()
  if (error) return error
  if (!canManageFinance(session!.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null) as { overdueDays?: unknown } | null
  const days = Number(body?.overdueDays)
  if (!Number.isInteger(days) || days < 0 || days > 3650) {
    return NextResponse.json({ error: 'Overdue days must be a whole number between 0 and 3650' }, { status: 400 })
  }
  await setFinanceOverdueDays(days, Number(session!.user.id))
  return NextResponse.json({ success: true, overdueDays: days })
}
