import { auth } from '@/auth'
import { NextResponse } from 'next/server'

export async function requireSession() {
  const session = await auth()
  if (!session?.user) {
    return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session, error: null }
}

export async function requireSuperadmin() {
  const result = await requireSession()
  if (result.error) return result
  if (result.session!.user.role !== 'superadmin') {
    return {
      session: null,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }
  return result
}
