import type { NextAuthConfig } from 'next-auth'
import { isAccountRole } from './roles'

interface CurrentAccount {
  id: number
  username: string
  fullName: string | null
  role: string
  isActive: boolean
}

type JwtCallback = NonNullable<NonNullable<NextAuthConfig['callbacks']>['jwt']>

export function createCurrentAccountJwtCallback(
  loadAccount: (id: number) => Promise<CurrentAccount | null>,
): JwtCallback {
  return async ({ token, user }) => {
    const id = Number(user?.id ?? token.id)
    if (!Number.isSafeInteger(id) || id <= 0) return null

    // Roles in existing cookies may predate an account change or deactivation.
    const account = await loadAccount(id)
    if (!account?.isActive || !isAccountRole(account.role)) return null

    return {
      ...token,
      id: String(account.id),
      username: account.username,
      name: account.fullName ?? account.username,
      role: account.role,
    }
  }
}
