import type { FileSlotConfig } from './slotConfig'

export function SlotIcon({ type }: { type: FileSlotConfig['icon'] }) {
  const stroke = '#9CA3AF'
  const fill = '#D1D5DB'

  switch (type) {
    case 'scan':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <ellipse cx="32" cy="28" rx="22" ry="14" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <path d="M14 42 Q32 52 50 42" fill="none" stroke={stroke} strokeWidth="1.5" />
          <rect x="26" y="8" width="12" height="6" rx="2" fill={fill} stroke={stroke} />
        </svg>
      )
    case 'buccal':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <path
            d="M20 48 Q32 12 44 48"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          <ellipse cx="32" cy="36" rx="8" ry="12" fill="#E5E7EB" stroke={stroke} strokeWidth="1" />
          <path d="M32 24 V16 M28 20 H36" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )
    case 'photo':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <rect x="8" y="14" width="48" height="36" rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <circle cx="24" cy="28" r="6" fill="#E5E7EB" stroke={stroke} />
          <path d="M12 44 L28 30 L40 38 L52 26" stroke={stroke} strokeWidth="1.5" fill="none" />
        </svg>
      )
    case 'xray':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <rect x="10" y="10" width="44" height="44" rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <ellipse cx="32" cy="32" rx="14" ry="10" fill="none" stroke={stroke} strokeWidth="1.5" />
          <path d="M20 32 H44 M32 20 V44" stroke={stroke} strokeWidth="1" opacity="0.5" />
        </svg>
      )
    case 'intraoral':
      return (
        <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
          <path
            d="M12 32 Q20 18 32 20 Q44 18 52 32 Q44 46 32 44 Q20 46 12 32Z"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          {[20, 28, 36, 44].map((x) => (
            <rect key={x} x={x} y="26" width="4" height="12" rx="1" fill="#E5E7EB" stroke={stroke} strokeWidth="0.5" />
          ))}
        </svg>
      )
  }
}
