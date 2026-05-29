import { z } from 'zod'

export const VITA_SHADES = [
  'A1', 'A2', 'A3', 'A3.5', 'A4',
  'B1', 'B2', 'B3', 'B4',
  'C1', 'C2', 'C3', 'C4',
  'D2', 'D3', 'D4',
] as const

export const FILE_SLOT_IDS = [
  'upper-model',
  'lower-model',
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
  orderNo: z.string().min(1, 'Order number is required'),
  dateSent: z.string().optional(),
  repair: z.boolean(),
  redo: z.boolean(),
  urgent: z.boolean(),
  dentist: z.string().min(1, 'Dentist name is required'),
  patient: z.string().min(1, 'Patient name is required'),
  clinic: z.string().min(1, 'Clinic name is required'),
  age: z.string().optional(),
  sex: z.enum(['male', 'female', '']).optional(),
  dateRequired: z.string().min(1, 'Date required is required'),
  oldOrderNo: z.string().optional(),

  orthodontics: z.string().optional(),
  nightGuardType: z.enum(['soft', 'hard', '']).optional(),
  orthodonticsOther: z.string().optional(),
  allergies: z.enum(['yes', 'no', '']).optional(),
  looseTooth: z.enum(['yes', 'no', '']).optional(),
  toothDecay: z.enum(['yes', 'no', '']).optional(),

  implantBrand: z.string().optional(),
  implantSystem: z.string().optional(),
  implantSize: z.string().optional(),
  implantType: z.string().optional(),
  implantOther: z.string().optional(),

  fixedType: z.string().optional(),
  fixedTypeOther: z.string().optional(),
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
  orderNo: '',
  dateSent: '',
  repair: false,
  redo: false,
  urgent: false,
  dentist: '',
  patient: '',
  clinic: '',
  age: '',
  sex: '',
  dateRequired: '',
  oldOrderNo: '',

  orthodontics: '',
  nightGuardType: '',
  orthodonticsOther: '',
  allergies: '',
  looseTooth: '',
  toothDecay: '',

  implantBrand: '',
  implantSystem: '',
  implantSize: '',
  implantType: '',
  implantOther: '',

  fixedType: '',
  fixedTypeOther: '',
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
