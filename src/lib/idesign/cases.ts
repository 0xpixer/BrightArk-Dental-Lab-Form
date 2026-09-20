import { z } from 'zod'

export const IDESIGN_GENDERS = ['Male', 'Female', 'Other'] as const
export const DENTITION_STAGES = ['Permanent Dentition', 'Mixed Dentition', 'Primary Dentition'] as const
export const MIDLINE_OPTIONS = ['Auto', 'Move left', 'Move right', 'Maintain', 'Match opposing midline'] as const
export const RELATIONSHIP_OPTIONS = [
  'Auto',
  'Maintain',
  'Improve Canine and Molar Relationship',
  'Improve Canine Relationship Only',
] as const

export const IDESIGN_REQUIRED_FILE_SLOTS = [
  'upper-model',
  'lower-model',
  'frontal-view',
  'frontal-smile',
  'profile-view',
] as const

export const IDESIGN_FILE_SLOTS = [
  ...IDESIGN_REQUIRED_FILE_SLOTS,
  'panoramic-xray',
  'lateral-ceph',
  'upper-arch',
  '45-central',
  'right-occlusal',
  'central-occlusal',
  'left-occlusal',
  'lower-arch',
  'cbct',
] as const

export type IDesignFileSlot = (typeof IDESIGN_FILE_SLOTS)[number]

export const PERMANENT_TEETH = [
  18, 17, 16, 15, 14, 13, 12, 11,
  21, 22, 23, 24, 25, 26, 27, 28,
  48, 47, 46, 45, 44, 43, 42, 41,
  31, 32, 33, 34, 35, 36, 37, 38,
] as const

export const PRIMARY_TEETH = [
  55, 54, 53, 52, 51,
  61, 62, 63, 64, 65,
  85, 84, 83, 82, 81,
  71, 72, 73, 74, 75,
] as const

const validTeeth = new Set<number>([...PERMANENT_TEETH, ...PRIMARY_TEETH])
const toothSelection = z.array(z.number().int().refine((tooth) => validTeeth.has(tooth), 'Invalid FDI tooth number')).max(validTeeth.size).default([])

const fileReferenceSchema = z.object({
  url: z.string().url().refine((value) => value.startsWith('https://'), 'File URL must use HTTPS'),
  name: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative().max(500 * 1024 * 1024),
  type: z.string().max(120),
})

const dateSchema = z.string().refine((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Enter a valid date')

export const createIDesignCaseSchema = z.object({
  patientName: z.string().trim().min(1, 'Name is required').max(200),
  gender: z.enum(IDESIGN_GENDERS),
  dateOfBirth: dateSchema,
  fileUrls: z.record(z.array(fileReferenceSchema).max(25)).superRefine((files, context) => {
    for (const slot of Object.keys(files)) {
      if (!IDESIGN_FILE_SLOTS.includes(slot as IDesignFileSlot)) context.addIssue({ code: z.ZodIssueCode.custom, path: [slot], message: 'Unknown upload slot' })
    }
    for (const slot of IDESIGN_REQUIRED_FILE_SLOTS) {
      if (!files[slot]?.length) context.addIssue({ code: z.ZodIssueCode.custom, path: [slot], message: 'Required file is missing' })
    }
    for (const slot of ['upper-model', 'lower-model'] as const) {
      if (files[slot]?.some((file) => !/\.stl$/i.test(file.name))) context.addIssue({ code: z.ZodIssueCode.custom, path: [slot], message: 'Upload an STL file' })
    }
    for (const slot of ['frontal-view', 'frontal-smile', 'profile-view', 'panoramic-xray', 'lateral-ceph', 'upper-arch', '45-central', 'right-occlusal', 'central-occlusal', 'left-occlusal', 'lower-arch'] as const) {
      if (files[slot]?.some((file) => !/\.(?:jpe?g|png|webp)$/i.test(file.name))) context.addIssue({ code: z.ZodIssueCode.custom, path: [slot], message: 'Upload a JPG, PNG, or WebP image' })
    }
  }),
  dentitionStage: z.enum(DENTITION_STAGES).optional().nullable(),
  extractionTeeth: toothSelection,
  lockedTeeth: toothSelection,
  attachmentRestrictedTeeth: toothSelection,
  iprRestrictedTeeth: toothSelection,
  reserveSpaceTeeth: toothSelection,
  maxillaryMidline: z.string().trim().max(80).optional().nullable(),
  mandibularMidline: z.string().trim().max(80).optional().nullable(),
  leftRelationship: z.enum(RELATIONSHIP_OPTIONS).optional().nullable(),
  rightRelationship: z.enum(RELATIONSHIP_OPTIONS).optional().nullable(),
  posteriorExpansionNotAllowed: z.object({ maxillary: z.boolean(), mandibular: z.boolean() }),
  iprNotAllowed: z.object({
    upperAnterior: z.boolean(),
    upperLeftPosterior: z.boolean(),
    upperRightPosterior: z.boolean(),
    lowerAnterior: z.boolean(),
    lowerLeftPosterior: z.boolean(),
    lowerRightPosterior: z.boolean(),
  }),
  molarDistalizationNotAllowed: z.object({ upperLeft: z.boolean(), upperRight: z.boolean(), lowerLeft: z.boolean(), lowerRight: z.boolean() }),
  remarks: z.string().trim().max(500).optional().nullable().transform((value) => value || null),
})

export type CreateIDesignCaseInput = z.infer<typeof createIDesignCaseSchema>

export function createIDesignCaseOrderNo(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '')
  return `IDA-${date}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`
}
