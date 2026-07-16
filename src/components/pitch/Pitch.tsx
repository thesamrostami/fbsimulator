import type { ReactNode } from 'react'

/**
 * A portrait football pitch under floodlights. Children (player chips) are
 * positioned absolutely by the parent using formation coordinates.
 */
export function Pitch({ children }: { children: ReactNode }) {
  return (
    <div
      data-testid="pitch"
      className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-pitch-line/60 shadow-2xl shadow-black/60"
      style={{
        background:
          'repeating-linear-gradient(0deg, #0d2818 0px, #0d2818 44px, #0f2e1c 44px, #0f2e1c 88px)',
      }}
    >
      {/* floodlight sheen */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 60% at 50% 0%, rgba(238,245,240,0.10), transparent 55%)',
        }}
      />
      {/* pitch markings */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 300 400"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <g fill="none" stroke="#eef5f0" strokeOpacity="0.22" strokeWidth="1.5">
          <rect x="8" y="8" width="284" height="384" rx="2" />
          <line x1="8" y1="200" x2="292" y2="200" />
          <circle cx="150" cy="200" r="36" />
          {/* bottom (own) penalty box */}
          <rect x="75" y="330" width="150" height="62" />
          <rect x="113" y="368" width="74" height="24" />
          {/* top (opponent) penalty box */}
          <rect x="75" y="8" width="150" height="62" />
          <rect x="113" y="8" width="74" height="24" />
        </g>
        <g fill="#eef5f0" fillOpacity="0.22">
          <circle cx="150" cy="200" r="2" />
          <circle cx="150" cy="352" r="2" />
          <circle cx="150" cy="48" r="2" />
        </g>
      </svg>
      {children}
    </div>
  )
}
