export function BrightArkLogo({ className = 'h-9 w-auto' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 180 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="BrightArk"
      role="img"
    >
      <circle cx="18" cy="20" r="14" fill="#F47B20" />
      <path
        d="M12 26V14h3.2c2 0 3.2 1 3.2 2.5 0 1-.5 1.8-1.5 2.1L20 26h-2.4l-2-3.2h-1.6V26H12zm2.2-5.2h1c.8 0 1.2-.4 1.2-1s-.4-1-1.2-1h-1v2z"
        fill="#fff"
      />
      <text x="40" y="27" fontFamily="Noto Sans, sans-serif" fontSize="18" fontWeight="700" fill="#1A1D2E">
        Bright
      </text>
      <text x="102" y="27" fontFamily="Noto Sans, sans-serif" fontSize="18" fontWeight="700" fill="#F47B20">
        Ark
      </text>
      <rect x="96" y="10" width="3" height="20" rx="1" fill="#1E6DBF" opacity="0.3" />
    </svg>
  )
}
