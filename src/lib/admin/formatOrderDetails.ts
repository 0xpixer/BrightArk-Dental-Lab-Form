type DetailValue = unknown

const DETAIL_LABELS: Record<string, string> = {
  notation: 'Notation',
  selectedTeeth: 'Selected Teeth',
  toothMode: 'Tooth Mode',
  shade: 'Shade',
  stumpShade: 'Stump Shade',
  occlusalStain: 'Occlusal Stain',
  orthodontics: 'Orthodontics',
  nightGuardType: 'Night Guard Type',
  orthodonticsOther: 'Orthodontics Other',
  allergies: 'Allergies',
  looseTooth: 'Loose Tooth',
  toothDecay: 'Tooth Decay',
  implantSeries: 'Implant Series',
  implantBrand: 'Brand',
  implantSystem: 'System',
  implantSize: 'Size',
  implantType: 'Type',
  implantOther: 'Other',
  fixedType: 'Type',
  fixedSubDetail: 'Sub-detail',
  fixedMaterial: 'Material',
  fixedMaterialOther: 'Material Other',
  marginDesign: 'Margin Design',
  marginMetalLingualMm: 'Metal Lingual',
  marginOther: 'Margin Other',
  ponticDesign: 'Pontic Design',
  interproximal: 'Interproximal Contact',
  occlusalContact: 'Occlusal Contact',
  insufficientRoom: 'Insufficient Room',
  insufficientRoomSub: 'Insufficient Room Sub-detail',
  removableArch: 'Arch',
  removableType: 'Type',
  customTrayHole: 'Custom Tray Hole',
  removableOther: 'Other',
  removableMaterial: 'Material',
  tissueShade: 'Tissue Shade',
  additionalGroup: 'Product Group',
  additionalProduct: 'Product',
  additionalOther: 'Other Product',
}

const DETAIL_ORDER = [
  'notation',
  'selectedTeeth',
  'toothMode',
  'shade',
  'stumpShade',
  'occlusalStain',
  'orthodontics',
  'nightGuardType',
  'orthodonticsOther',
  'allergies',
  'looseTooth',
  'toothDecay',
  'implantSeries',
  'implantBrand',
  'implantSystem',
  'implantSize',
  'implantType',
  'implantOther',
  'fixedType',
  'fixedSubDetail',
  'fixedMaterial',
  'fixedMaterialOther',
  'marginDesign',
  'marginMetalLingualMm',
  'marginOther',
  'ponticDesign',
  'interproximal',
  'occlusalContact',
  'insufficientRoom',
  'insufficientRoomSub',
  'removableArch',
  'removableType',
  'customTrayHole',
  'removableOther',
  'removableMaterial',
  'tissueShade',
  'additionalGroup',
  'additionalProduct',
  'additionalOther',
]

function isEmptyValue(value: DetailValue): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0
  return false
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim()
}

function formatValue(key: string, value: DetailValue): string {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'object' && value !== null) {
    return formatDetailLines(value as Record<string, unknown>).join('\n')
  }
  if (key === 'marginMetalLingualMm') return `${String(value)} mm`
  return String(value)
}

export function formatDetailLines(details: Record<string, unknown> | null | undefined): string[] {
  if (!details) return []

  const keys = [
    ...DETAIL_ORDER.filter((key) => Object.prototype.hasOwnProperty.call(details, key)),
    ...Object.keys(details).filter((key) => !DETAIL_ORDER.includes(key)),
  ]

  return keys
    .filter((key) => !isEmptyValue(details[key]))
    .map((key) => `${DETAIL_LABELS[key] ?? humanizeKey(key)}: ${formatValue(key, details[key])}`)
}
