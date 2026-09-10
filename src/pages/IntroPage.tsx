import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { HeroBall } from '../components/brand/HeroBall'
import { Wordmark } from '../components/brand/Wordmark'
import { FOCUS_RING } from '../ui/theme'
import { ThemeToggle } from '../ui/themeMode'

export function IntroPage() {
  const navigate = useNavigate()

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-10 text-center">
      <ThemeToggle className="absolute right-4 top-4 z-10" />
      {/* Floodlight beams sweeping gently */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 45% at 20% -8%, color-mix(in srgb, var(--color-brand-b) 12%, transparent), transparent 60%), radial-gradient(60% 45% at 80% -8%, color-mix(in srgb, var(--color-brand-a) 10%, transparent), transparent 60%)',
        }}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Pitch glow at the horizon */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-64"
        style={{ background: 'radial-gradient(80% 100% at 50% 120%, color-mix(in srgb, var(--color-brand-a) 18%, transparent), transparent 70%)' }}
      />

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-5 text-xs font-bold uppercase tracking-[0.45em] text-muted sm:text-sm"
      >
        The what-if knockout simulator
      </motion.p>

      {/* Original wordmark lockup. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.25, type: 'spring', stiffness: 200, damping: 20 }}
      >
        <Wordmark />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="mt-5 font-display text-lg font-black uppercase tracking-[0.3em] text-floodlight sm:text-xl"
      >
        Rewrite the knockouts
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 36, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.75, type: 'spring', stiffness: 170, damping: 18 }}
        className="mt-7"
      >
        <HeroBall />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
        className="mt-6 max-w-md text-base leading-relaxed text-muted sm:text-lg"
      >
        Pick a match. Change the lineup. See what could have been.
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, type: 'spring', stiffness: 220, damping: 22 }}
        whileHover={{ scale: 1.05, boxShadow: '0 0 42px color-mix(in srgb, var(--color-brand-a) 45%, transparent)' }}
        whileTap={{ scale: 0.96 }}
        onClick={() => navigate('/bracket')}
        className={`mt-8 rounded-xl px-10 py-4 font-display text-lg font-black uppercase tracking-widest text-night ${FOCUS_RING}`}
        style={{ background: 'linear-gradient(100deg, var(--color-brand-a), var(--color-brand-b))' }}
      >
        Enter the bracket ▸
      </motion.button>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.55 }}
        className="mt-6 text-xs text-muted"
      >
        16 real knockout matches · every lineup editable · 1,000 replays per kick-off
        <span className="mx-2" aria-hidden="true">
          ·
        </span>
        <Link to="/how-it-works" className="underline underline-offset-2 transition-colors hover:text-floodlight">
          how it works
        </Link>
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.75 }}
        className="mt-3 text-[11px] text-muted/80"
      >
        An independent fan project — not affiliated with, endorsed by, or sponsored by FIFA.
      </motion.p>
    </main>
  )
}
