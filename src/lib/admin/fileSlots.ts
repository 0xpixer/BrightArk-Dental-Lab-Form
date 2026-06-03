export const SLOT_FOLDER_MAP: Record<string, { folder: string; filename: string }> = {
  'upper-model': { folder: 'oral_scans', filename: 'upper_arch' },
  'lower-model': { folder: 'oral_scans', filename: 'lower_arch' },
  'left-buccal': { folder: 'oral_scans', filename: 'left_buccal' },
  'right-buccal': { folder: 'oral_scans', filename: 'right_buccal' },
  'frontal-view': { folder: 'facial_photos', filename: 'frontal_view' },
  'frontal-smile': { folder: 'facial_photos', filename: 'frontal_smile' },
  'profile-view': { folder: 'facial_photos', filename: 'profile_view' },
  'upper-arch': { folder: 'intraoral', filename: 'upper_arch' },
  'shade-tab': { folder: 'intraoral', filename: 'tooth_with_shade_tab' },
  '45-central': { folder: 'intraoral', filename: '45_central' },
  'right-occlusal': { folder: 'intraoral', filename: 'right_occlusal' },
  'central-occlusal': { folder: 'intraoral', filename: 'central_occlusal' },
  'left-occlusal': { folder: 'intraoral', filename: 'left_occlusal' },
  'lower-arch': { folder: 'intraoral', filename: 'lower_arch' },
}

export function getExtensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const ext = pathname.split('.').pop()?.split('?')[0]
    if (ext && ext.length <= 5) return ext.toLowerCase()
  } catch {
    /* ignore */
  }
  return 'bin'
}
