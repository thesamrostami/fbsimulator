/**
 * Original "Replay Cup" wordmark: the site's broadcast condensed type with
 * the tournament year worked in as a skewed score-bug chip. Pure CSS — no
 * asset files, gradient straight from the palette.
 */
const CHIP_GRADIENT = 'linear-gradient(100deg, #2fbf71, #5aa9ff)'

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-start font-display font-black uppercase leading-none tracking-tight ${
        compact ? 'gap-1.5 text-2xl sm:text-3xl' : 'gap-2.5 text-6xl sm:text-8xl'
      }`}
    >
      <span className="text-floodlight">
        Replay <span className="bg-gradient-to-r from-mexico to-england bg-clip-text text-transparent">Cup</span>
      </span>
      <span
        aria-label="26"
        className={`inline-block rounded-sm text-center font-black text-night ${
          compact ? 'px-1 pb-0.5 pt-1 text-[0.4em]' : 'px-1.5 pb-1 pt-1.5 text-[0.34em]'
        }`}
        style={{ background: CHIP_GRADIENT, transform: 'skewX(-8deg)' }}
      >
        <span className="inline-block" style={{ transform: 'skewX(8deg)' }}>
          26
        </span>
      </span>
    </span>
  )
}
