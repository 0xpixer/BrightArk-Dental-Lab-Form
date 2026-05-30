import type { OrderFormValues, TreatmentCategory } from '@/types/orderForm'

const TREATMENT_TYPE_LABELS: Record<TreatmentCategory, string> = {
  orthodontics: 'Orthodontics',
  implant: 'Implant',
  fixed: 'Fixed Restoration',
  removable: 'Removable Restoration',
}

export function parseDateDDMMYYYY(value: string | undefined): string | null {
  if (!value) return null
  const [d, m, y] = value.split('/').map(Number)
  if (!d || !m || !y) return null
  const date = new Date(y, m - 1, d)
  if (isNaN(date.getTime())) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function defaultDateRequired(): string {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return d.toISOString().slice(0, 10)
}

function formatSex(sex: string | undefined): string | null {
  if (sex === 'male') return 'Male'
  if (sex === 'female') return 'Female'
  return null
}

function buildTreatmentData(values: OrderFormValues): Record<string, unknown> {
  const category = values.treatmentCategory
  if (!category) return {}

  switch (category) {
    case 'orthodontics':
      return {
        orthodontics: values.orthodontics,
        nightGuardType: values.nightGuardType,
        orthodonticsOther: values.orthodonticsOther,
        allergies: values.allergies,
        looseTooth: values.looseTooth,
        toothDecay: values.toothDecay,
      }
    case 'implant':
      return {
        implantBrand: values.implantBrand,
        implantSystem: values.implantSystem,
        implantSize: values.implantSize,
        implantType: values.implantType,
        implantOther: values.implantOther,
      }
    case 'fixed':
      return {
        fixedType: values.fixedType,
        fixedTypeOther: values.fixedTypeOther,
        fixedMaterial: values.fixedMaterial,
        fixedMaterialOther: values.fixedMaterialOther,
        marginDesign: values.marginDesign,
        marginMetalLingualMm: values.marginMetalLingualMm,
        marginOther: values.marginOther,
        ponticDesign: values.ponticDesign,
        interproximal: values.interproximal,
        occlusalContact: values.occlusalContact,
        insufficientRoom: values.insufficientRoom,
        insufficientRoomSub: values.insufficientRoomSub,
      }
    case 'removable':
      return {
        removableArch: values.removableArch,
        removableType: values.removableType,
        customTrayHole: values.customTrayHole,
        removableOther: values.removableOther,
        removableMaterial: values.removableMaterial,
        tissueShade: values.tissueShade,
      }
    default:
      return {}
  }
}

function buildToothSelection(values: OrderFormValues): Record<string, unknown> {
  return {
    selectedTeeth: values.selectedTeeth,
    toothMode: values.toothMode,
    shade: values.shade,
    stumpShade: values.stumpShade,
    occlusalStain: values.occlusalStain,
    restOn: values.restOn,
    claspOn: values.claspOn,
  }
}

export interface OrderApiPayload extends OrderFormValues {
  orderNo?: string
  file_urls?: Record<string, string>
}

export function mapPayloadToOrderInsert(payload: OrderApiPayload) {
  const orderNo = payload.orderNo ?? `BA-${Date.now()}`
  const dateSent = new Date()
  const patientDob = parseDateDDMMYYYY(payload.patientDob)

  if (!patientDob) {
    throw new Error('Patient DOB is required and must be in DD/MM/YYYY format')
  }

  const category = payload.treatmentCategory as TreatmentCategory | ''
  const treatmentType = category ? TREATMENT_TYPE_LABELS[category] : null

  return {
    orderNo,
    dateSent,
    dentist: payload.dentist,
    clinic: payload.clinic,
    patientName: payload.patient,
    patientDob,
    sex: formatSex(payload.sex),
    dateRequired: defaultDateRequired(),
    isRepair: payload.repair,
    isRedo: payload.redo,
    isUrgent: payload.urgent,
    oldOrderNo: payload.oldOrderNo || null,
    treatmentType,
    treatmentData: buildTreatmentData(payload),
    toothSelection: buildToothSelection(payload),
    instructions: payload.instructions || null,
    fileUrls: payload.file_urls ?? {},
    status: 'pending' as const,
  }
}
