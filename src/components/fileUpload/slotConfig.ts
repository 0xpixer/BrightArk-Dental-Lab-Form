import type { FileSlotId } from '../../types/orderForm'

export interface FileSlotConfig {
  id: FileSlotId
  label: string
  required?: boolean
  accept: string
  icon: 'scan' | 'photo' | 'xray' | 'intraoral'
}

export interface FileSlotGroup {
  heading: string
  note?: string
  tooltip?: string
  slots: FileSlotConfig[]
}

export const FILE_SLOT_GROUPS: FileSlotGroup[] = [
  {
    heading: 'Oral Scans',
    note: 'Do not upload back-cover scan files',
    slots: [
      { id: 'upper-model', label: 'Upper Model', required: true, accept: '.obj,.ply,.stl', icon: 'scan' },
      { id: 'lower-model', label: 'Lower Model', required: true, accept: '.obj,.ply,.stl', icon: 'scan' },
    ],
  },
  {
    heading: 'Facial Photos',
    tooltip: 'JPG/JPEG/PNG only',
    slots: [
      { id: 'frontal-view', label: 'Frontal View', accept: 'image/jpeg,image/png,image/jpg', icon: 'photo' },
      { id: 'frontal-smile', label: 'Frontal Smile', accept: 'image/jpeg,image/png,image/jpg', icon: 'photo' },
      { id: 'profile-view', label: 'Profile View', accept: 'image/jpeg,image/png,image/jpg', icon: 'photo' },
    ],
  },
  {
    heading: 'X-ray',
    tooltip: 'JPG/JPEG/PNG only',
    slots: [
      { id: 'panoramic-xray', label: 'Panoramic X-ray', accept: 'image/jpeg,image/png,image/jpg', icon: 'xray' },
      { id: 'lateral-ceph', label: 'Lateral Ceph', accept: 'image/jpeg,image/png,image/jpg', icon: 'xray' },
    ],
  },
  {
    heading: 'Intraoral Photos',
    tooltip: 'JPG/JPEG/PNG only',
    slots: [
      { id: 'upper-arch', label: 'Upper Arch', accept: 'image/jpeg,image/png,image/jpg', icon: 'intraoral' },
      { id: '45-central', label: '45° Central', accept: 'image/jpeg,image/png,image/jpg', icon: 'intraoral' },
      { id: 'right-occlusal', label: 'Right (Occlusal)', accept: 'image/jpeg,image/png,image/jpg', icon: 'intraoral' },
      { id: 'central-occlusal', label: 'Central (Occlusal)', accept: 'image/jpeg,image/png,image/jpg', icon: 'intraoral' },
      { id: 'left-occlusal', label: 'Left (Occlusal)', accept: 'image/jpeg,image/png,image/jpg', icon: 'intraoral' },
      { id: 'lower-arch', label: 'Lower Arch', accept: 'image/jpeg,image/png,image/jpg', icon: 'intraoral' },
    ],
  },
]

export const ALL_SLOTS = FILE_SLOT_GROUPS.flatMap((g) => g.slots)

export function getSlotById(id: FileSlotId) {
  return ALL_SLOTS.find((s) => s.id === id)
}
