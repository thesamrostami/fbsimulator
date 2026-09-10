import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { SiteFooter } from './components/brand/SiteFooter'
import { SiteHeader } from './components/brand/SiteHeader'
import { BracketPage } from './pages/BracketPage'
import { HowItWorksPage } from './pages/HowItWorksPage'
import { IntroPage } from './pages/IntroPage'
import { MatchPage } from './pages/MatchPage'

function PageShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.01 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  const location = useLocation()

  // Each page starts at the top; the router preserves scroll by default.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  const intro = location.pathname === '/'

  return (
    <>
      {!intro && <SiteHeader />}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <PageShell>
                <IntroPage />
              </PageShell>
            }
          />
          <Route
            path="/bracket"
            element={
              <PageShell>
                <BracketPage />
              </PageShell>
            }
          />
          <Route
            path="/match/:id"
            element={
              <PageShell>
                <MatchPage />
              </PageShell>
            }
          />
          <Route
            path="/how-it-works"
            element={
              <PageShell>
                <HowItWorksPage />
              </PageShell>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
      <SiteFooter />
    </>
  )
}
