import type { OrderFormValues, TreatmentCategory } from '@/types/orderForm'

const TREATMENT_TYPE_LABELS: Record<TreatmentCategory, string> = {
  orthodontics: 'Orthodontics',
  implant: 'Implant',
  fixed: 'Fixed Restoration',
  additional: 'Lab Services',
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
        implantSeries: values.implantSeries,
        implantBrand: values.implantBrand,
        implantSystem: values.implantSystem,
        implantSize: values.implantSize,
        implantType: values.implantType,
        implantOther: values.implantOther,
      }
    case 'fixed':
      return {
        fixedType: values.fixedType,
        fixedSubDetail: values.fixedSubDetail,
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
        removableProduct: values.removableProduct,
        customTrayHole: values.customTrayHole,
        removableOther: values.removableOther,
        removableMaterial: values.removableMaterial,
        tissueShade: values.tissueShade,
      }
    case 'additional':
      return {
        additionalGroup: values.additionalGroup,
        additionalProduct: values.additionalProduct,
        additionalOther: values.additionalOther,
      }
    default:
      return {}
  }
}

function buildToothSelection(values: OrderFormValues): Record<string, unknown> {
  return {
    notation: 'FDI',
    selectedTeeth: values.selectedTeeth,
    toothMode: values.toothMode,
    shade: values.shade,
  }
}

export interface OrderApiPayload extends OrderFormValues {
  orderNo: string
  file_urls?: Record<string, string>
}

export function mapPayloadToOrderInsert(payload: OrderApiPayload) {
  const dateSent = new Date()
  const patientDob = parseDateDDMMYYYY(payload.patientDob)

  const category = payload.treatmentCategory as TreatmentCategory | ''
  const treatmentType = category ? TREATMENT_TYPE_LABELS[category] : null

  return {
    orderNo: payload.orderNo,
    dateSent,
    dentist: payload.dentist,
    clinic: payload.clinic,
    email: payload.email,
    altEmail: null,
    phone: null,
    address: payload.address || null,
    patientName: payload.patient,
    patientDob,
    patientAge: payload.patientAge || null,
    sex: formatSex(payload.sex),
    dateRequired: null,
    isRepair: false,
    isRedo: false,
    isUrgent: false,
    oldOrderNo: null,
    treatmentType,
    treatmentData: buildTreatmentData(payload),
    toothSelection: buildToothSelection(payload),
    instructions: payload.instructions || null,
    fileUrls: payload.file_urls ?? {},
    cloudDriveLink: payload.cloudDriveLink || null,
    status: 'pending' as const,
  }
}
