import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import { isAdminRole, isPortalRole } from './roles'

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

export async function requireAdmin() {
  const result = await requireSession()
  if (result.error) return result
  if (!isAdminRole(result.session!.user.role)) {
    return { session: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return result
}

export async function requirePortalUser() {
  const result = await requireSession()
  if (result.error) return result
  if (!isPortalRole(result.session!.user.role)) {
    return { session: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return result
}
