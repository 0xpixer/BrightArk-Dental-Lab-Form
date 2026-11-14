import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { getDefaultOverviewPath } from '@/lib/siteRouting'

export default function manifest(): MetadataRoute.Manifest {
  const requestHeaders = headers()
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host')
  return {
    id: '/',
    name: 'BrightArk Order Portal',
    short_name: 'BrightArk',
    description: 'Manage dental lab and clear aligner orders with BrightArk',
    // Open straight into the dashboard; middleware sends signed-out users to the login page.
    start_url: getDefaultOverviewPath(host),
    scope: '/',
    display: 'standalone',
    background_color: '#F7F7F8',
    theme_color: '#FFFFFF',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
