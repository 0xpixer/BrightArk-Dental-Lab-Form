import { z } from 'zod'

export const VITA_SHADES = [
  'A1', 'A2', 'A3', 'A3.5', 'A4',
  'B1', 'B2', 'B3', 'B4',
  'C1', 'C2', 'C3', 'C4',
  'D2', 'D3', 'D4',
] as const

export const TREATMENT_CATEGORIES = [
  'orthodontics',
  'implant',
  'fixed',
  'removable',
] as const

export type TreatmentCategory = (typeof TREATMENT_CATEGORIES)[number]

export const FILE_SLOT_IDS = [
  'upper-model',
  'lower-model',
  'left-buccal',
  'right-buccal',
  'frontal-view',
  'frontal-smile',
  'profile-view',
  'panoramic-xray',
  'lateral-ceph',
  'upper-arch',
  '45-central',
  'right-occlusal',
  'central-occlusal',
  'left-occlusal',
  'lower-arch',
] as const

export type FileSlotId = (typeof FILE_SLOT_IDS)[number]

export interface UploadedFileMeta {
  slotId: FileSlotId | 'unassigned'
  name: string
  size: number
  type: string
  previewUrl?: string
  progress: number
}

export const orderFormSchema = z.object({
  treatmentCategory: z.enum(['orthodontics', 'implant', 'fixed', 'removable', '']).optional(),
  repair: z.boolean(),
  redo: z.boolean(),
  urgent: z.boolean(),
  dentist: z.string().min(1, 'Dentist name is required'),
  patient: z.string().min(1, 'Patient name is required'),
  clinic: z.string().min(1, 'Clinic name is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  phone: z.string().optional(),
  address: z.string().min(1, 'Address is required'),
  patientDob: z.string().optional(),
  sex: z.enum(['male', 'female', '']).optional(),
  dateRequired: z.string().optional(),
  oldOrderNo: z.string().optional(),

  orthodontics: z.string().optional(),
  nightGuardType: z.enum(['soft', 'hard', '']).optional(),
  orthodonticsOther: z.string().optional(),
  allergies: z.enum(['yes', 'no', '']).optional(),
  looseTooth: z.enum(['yes', 'no', '']).optional(),
  toothDecay: z.enum(['yes', 'no', '']).optional(),

  implantSeries: z.string().optional(),
  implantBrand: z.string().optional(),
  implantSystem: z.string().optional(),
  implantSize: z.string().optional(),
  implantType: z.string().optional(),
  implantOther: z.string().optional(),

  fixedType: z.string().optional(),
  fixedTypeOther: z.string().optional(),
  fixedSubDetail: z.string().optional(),
  fixedMaterial: z.string().optional(),
  fixedMaterialOther: z.string().optional(),
  marginDesign: z.string().optional(),
  marginMetalLingualMm: z.string().optional(),
  marginOther: z.string().optional(),

  removableArch: z.enum(['upper', 'lower', '']).optional(),
  removableType: z.string().optional(),
  customTrayHole: z.enum(['with-hole', 'without-hole', '']).optional(),
  removableOther: z.string().optional(),
  removableMaterial: z.string().optional(),
  tissueShade: z.string().optional(),

  ponticDesign: z.string().optional(),
  interproximal: z.string().optional(),
  occlusalContact: z.string().optional(),
  insufficientRoom: z.string().optional(),
  insufficientRoomSub: z.enum(['resin', 'metal', '']).optional(),

  selectedTeeth: z.array(z.number()),
  toothMode: z.enum(['single', 'bridge']),
  shade: z.string().optional(),
  stumpShade: z.string().optional(),
  occlusalStain: z.enum(['none', 'light', 'medium', 'heavy']),
  restOn: z.string().optional(),
  claspOn: z.string().optional(),

  instructions: z.string().optional(),
})

export type OrderFormValues = z.infer<typeof orderFormSchema>

export const defaultFormValues: OrderFormValues = {
  treatmentCategory: 'fixed',
  repair: false,
  redo: false,
  urgent: false,
  dentist: '',
  patient: '',
  clinic: '',
  email: '',
  phone: '',
  address: '',
  patientDob: '',
  sex: '',
  dateRequired: '',
  oldOrderNo: '',

  orthodontics: '',
  nightGuardType: '',
  orthodonticsOther: '',
  allergies: '',
  looseTooth: '',
  toothDecay: '',

  implantSeries: '',
  implantBrand: '',
  implantSystem: '',
  implantSize: '',
  implantType: '',
  implantOther: '',

  fixedType: '',
  fixedTypeOther: '',
  fixedSubDetail: '',
  fixedMaterial: '',
  fixedMaterialOther: '',
  marginDesign: '',
  marginMetalLingualMm: '',
  marginOther: '',

  removableArch: '',
  removableType: '',
  customTrayHole: '',
  removableOther: '',
  removableMaterial: '',
  tissueShade: '',

  ponticDesign: '',
  interproximal: '',
  occlusalContact: '',
  insufficientRoom: '',
  insufficientRoomSub: '',

  selectedTeeth: [],
  toothMode: 'single',
  shade: '',
  stumpShade: '',
  occlusalStain: 'none',
  restOn: '',
  claspOn: '',

  instructions: '',
}

export const DRAFT_STORAGE_KEY = 'brightark-dental-lab-order-draft'

export function generateOrderNo(): string {
  return `BA-${Date.now()}`
}
