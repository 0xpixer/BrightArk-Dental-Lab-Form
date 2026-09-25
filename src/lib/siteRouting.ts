import { isPortalRole } from '@/lib/admin/roles'

export const IDESIGN_HOSTNAME = 'idesign.thebrightark.com'

export function isIDesignHostname(host: string | null): boolean {
  if (!host) return false

  return host.split(',')[0].trim().split(':')[0].toLowerCase() === IDESIGN_HOSTNAME
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
