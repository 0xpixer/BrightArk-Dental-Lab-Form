export const BANNER_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
export const BANNER_VIDEO_TYPES = ['video/mp4']
export const BANNER_ACCEPT = [...BANNER_IMAGE_TYPES, ...BANNER_VIDEO_TYPES, '.svg', '.mp4'].join(',')
export const BANNER_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const BANNER_VIDEO_MAX_BYTES = 50 * 1024 * 1024

export function isBannerVideoUrl(url: string) {
  return /\.mp4(?:$|[?#])/i.test(url)
}

/** Returns an error message, or null when the file is an acceptable banner. */
export function validateBannerFile(file: File): string | null {
  const name = file.name.toLowerCase()
  const isVideo = BANNER_VIDEO_TYPES.includes(file.type) || name.endsWith('.mp4')
  const isImage = BANNER_IMAGE_TYPES.includes(file.type) || name.endsWith('.svg')
  if (!isVideo && !isImage) return 'Use a JPG, PNG, WebP, GIF, SVG image or an MP4 video.'
  if (isVideo && file.size > BANNER_VIDEO_MAX_BYTES) return 'Banner videos must be 50 MB or smaller.'
  if (!isVideo && file.size > BANNER_IMAGE_MAX_BYTES) return 'Banner images must be 10 MB or smaller.'
  return null
}

export function bannerContentType(file: File) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.mp4')) return 'video/mp4'
  if (name.endsWith('.svg')) return 'image/svg+xml'
  return file.type || undefined
}

export function BannerMedia({ url, alt }: { url: string; alt: string }) {
  if (isBannerVideoUrl(url)) {
    return <video src={url} aria-label={alt} autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-cover" />
  }
  return <img src={url} alt={alt} className="h-full w-full object-cover" />
}
