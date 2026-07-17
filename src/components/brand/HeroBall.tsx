/**
 * Original hero match ball, drawn in SVG: a white sphere with a
 * meridian-band panel pattern (our own layout — nothing modeled on any
 * official ball) and two palette-gradient accent panels. The seam group
 * rotates slowly while the lighting overlays stay fixed, so the shading
 * reads as a lit ball spinning under the floodlights; float, glint sweep
 * and ground shadow reuse the existing keyframes.
 */
export function HeroBall() {
  return (
    <div className="relative w-36 sm:w-44">
      <div className="ball-float">
        <div className="relative overflow-hidden rounded-full">
          <svg
            viewBox="0 0 200 200"
            role="img"
            aria-label="Replay Cup match ball"
            className="block w-full"
            style={{ filter: 'drop-shadow(0 14px 26px rgba(0,0,0,0.45))' }}
          >
            <defs>
              <radialGradient id="rc-ball-base" cx="36%" cy="30%" r="80%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="55%" stopColor="#eef5f0" />
                <stop offset="100%" stopColor="#b7c8be" />
              </radialGradient>
              <linearGradient id="rc-ball-green" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#2fbf71" />
                <stop offset="100%" stopColor="#1d8a50" />
              </linearGradient>
              <linearGradient id="rc-ball-blue" x1="1" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5aa9ff" />
                <stop offset="100%" stopColor="#2f6fc0" />
              </linearGradient>
              <radialGradient id="rc-ball-shade" cx="36%" cy="30%" r="85%">
                <stop offset="0%" stopColor="#000000" stopOpacity="0" />
                <stop offset="72%" stopColor="#000000" stopOpacity="0" />
                <stop offset="100%" stopColor="#050d09" stopOpacity="0.38" />
              </radialGradient>
            </defs>

            <circle cx="100" cy="100" r="96" fill="url(#rc-ball-base)" />

            {/* Rotating seam-and-panel group. */}
            <g className="ball-rotate" style={{ transformOrigin: '100px 100px' }}>
              {/* Accent lens panels between the meridian seams. */}
              <path
                d="M100 4 C 55 52 55 148 100 196 C 72 148 72 52 100 4 Z"
                fill="url(#rc-ball-green)"
                opacity="0.85"
              />
              <path
                d="M100 4 C 145 52 145 148 100 196 C 128 148 128 52 100 4 Z"
                fill="url(#rc-ball-blue)"
                opacity="0.85"
              />
              {/* Meridian seams. */}
              <g fill="none" stroke="#12241a" strokeOpacity="0.55" strokeWidth="2">
                <path d="M100 4 C 55 52 55 148 100 196" />
                <path d="M100 4 C 72 52 72 148 100 196" />
                <path d="M100 4 C 145 52 145 148 100 196" />
                <path d="M100 4 C 128 52 128 148 100 196" />
                <path d="M100 4 C 22 56 22 144 100 196" />
                <path d="M100 4 C 178 56 178 144 100 196" />
                <path d="M100 4 L 100 196" />
              </g>
            </g>

            {/* Fixed lighting: rim shading + specular highlight. */}
            <circle cx="100" cy="100" r="96" fill="url(#rc-ball-shade)" />
            <ellipse cx="72" cy="56" rx="34" ry="22" fill="#ffffff" opacity="0.5" transform="rotate(-28 72 56)" />
          </svg>
          {/* Floodlight glint sweep, clipped to the ball's circle. */}
          <div
            aria-hidden="true"
            className="ball-glint pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent blur-[6px]"
          />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="ball-shadow mx-auto -mt-1 h-3.5 w-3/4 rounded-full"
        style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,0.55), transparent 70%)' }}
      />
    </div>
  )
}
