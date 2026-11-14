import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BrightArk Order Portal',
    short_name: 'BrightArk',
    description: 'Manage dental lab and clear aligner orders with BrightArk',
    start_url: '/admin/login',
    display: 'standalone',
    background_color: '#F7F7F8',
    theme_color: '#FFFFFF',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
