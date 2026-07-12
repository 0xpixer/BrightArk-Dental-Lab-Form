export const ADMIN_ROLES = ['admin', 'superadmin'] as const
export const PORTAL_ROLES = ['doctor', 'clinic_staff'] as const
export const ACCOUNT_ROLES = [...ADMIN_ROLES, ...PORTAL_ROLES] as const

export type AdminRole = (typeof ADMIN_ROLES)[number]
export type PortalRole = (typeof PORTAL_ROLES)[number]
export type AccountRole = (typeof ACCOUNT_ROLES)[number]

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && ADMIN_ROLES.includes(value as AdminRole)
}

export function isPortalRole(value: unknown): value is PortalRole {
  return typeof value === 'string' && PORTAL_ROLES.includes(value as PortalRole)
}

export function isAccountRole(value: unknown): value is AccountRole {
  return typeof value === 'string' && ACCOUNT_ROLES.includes(value as AccountRole)
}

export function formatAdminRole(role: string): string {
  if (role === 'superadmin') return 'Superadmin'
  if (role === 'clinic_staff') return 'Clinic Staff'
  if (role === 'doctor') return 'Doctor'
  return 'Admin'
}
