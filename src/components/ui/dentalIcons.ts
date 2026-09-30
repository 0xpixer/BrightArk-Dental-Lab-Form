import type { IconNode } from 'lucide'

const alignerShape: IconNode = [
  ['path', { d: 'M4 8c1.9-3 4.8-4.5 8-4.5S18.1 5 20 8l-1.2 7.2a5.7 5.7 0 0 1-5.6 4.8h-2.4a5.7 5.7 0 0 1-5.6-4.8L4 8Z' }],
  ['path', { d: 'M6.5 8.5c1.5-1.8 3.4-2.7 5.5-2.7s4 .9 5.5 2.7' }],
  ['path', { d: 'M6.8 11.5h10.4' }],
  ['path', { d: 'M9 6.7v4.8' }],
  ['path', { d: 'M12 5.8v5.7' }],
  ['path', { d: 'M15 6.7v4.8' }],
]

export const ClearAlignerIcon: IconNode = alignerShape

export const ClearAlignerActiveIcon: IconNode = [
  ...alignerShape,
  ['path', { d: 'M19 2v3' }],
  ['path', { d: 'M17.5 3.5h3' }],
]

const toothShape: IconNode = [
  ['path', { d: 'M12 4.1C10.4 4.1 9.1 2.8 7.2 3 4.4 3.3 3 5.5 3.3 8.2c.3 2.4 1.7 4.1 2.2 6.7.6 3.1 1.1 6.1 2.8 6.1 2.3 0 1.7-5.3 3.7-5.3s1.4 5.3 3.7 5.3c1.7 0 2.2-3 2.8-6.1.5-2.6 1.9-4.3 2.2-6.7C21 5.5 19.6 3.3 16.8 3 14.9 2.8 13.6 4.1 12 4.1Z' }],
  ['path', { d: 'M9.5 6.2c1.6.8 3.4.8 5 0' }],
]

export const ToothIcon: IconNode = toothShape

export const ToothPolishedIcon: IconNode = [
  ...toothShape,
  ['path', { d: 'M19.5 1.5v3' }],
  ['path', { d: 'M18 3h3' }],
]
