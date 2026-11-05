import { getFilenameFromUrl } from './admin/fileSlots'

export type FilePreviewKind = 'image' | 'stl' | 'ply' | null

const IMAGE_EXTENSION = /\.(?:jpe?g|png|webp)$/i
const STL_EXTENSION = /\.stl$/i
const PLY_EXTENSION = /\.ply$/i

export function getFilePreviewKind(url: string): FilePreviewKind {
  const filename = getFilenameFromUrl(url)
  if (!filename) return null
  if (IMAGE_EXTENSION.test(filename)) return 'image'
  if (STL_EXTENSION.test(filename)) return 'stl'
  if (PLY_EXTENSION.test(filename)) return 'ply'
  return null
}
