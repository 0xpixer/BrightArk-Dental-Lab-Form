import { isPortalRole } from '@/lib/admin/roles'

export const IDESIGN_HOSTNAME = 'order.thebrightark.com'
export const LEGACY_IDESIGN_HOSTNAME = 'idesign.thebrightark.com'

const IDESIGN_HOSTNAMES = new Set([IDESIGN_HOSTNAME, LEGACY_IDESIGN_HOSTNAME])

export function isIDesignHostname(host: string | null): boolean {
  if (!host) return false

  return IDESIGN_HOSTNAMES.has(host.split(',')[0].trim().split(':')[0].toLowerCase())
}

export function getIDesignOverviewPath(role?: unknown): string {
  return isPortalRole(role) ? '/portal/overview' : '/admin/overview?view=aligners'
}

export function getDefaultOverviewPath(host: string | null): string {
  return isIDesignHostname(host) ? '/admin/overview?view=aligners' : '/admin/overview'
}

export function getSafeLoginCallback(callbackUrl: string | null, host: string | null): string {
  if (callbackUrl?.startsWith('/') && !callbackUrl.startsWith('//')) return callbackUrl
  return getDefaultOverviewPath(host)
}

export function getLoginPath(callbackUrl: string): string {
  return `/admin/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
}
