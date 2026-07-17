import { Component, type ReactNode } from 'react'

interface State {
  hasError: boolean
}

/**
 * Last-resort boundary so a runtime error shows a branded recovery screen
 * instead of a blank page. Reload restores a clean state — nothing is
 * persisted beyond the session.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl font-black uppercase tracking-tight text-floodlight">
          VAR check gone wrong
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
          Something broke on our side. A reload puts everything back the way it was.
        </p>
        <button
          onClick={() => window.location.assign('/')}
          className="mt-6 rounded-xl px-8 py-3 font-display text-base font-black uppercase tracking-widest text-night"
          style={{ background: 'linear-gradient(100deg, #2fbf71, #5aa9ff)' }}
        >
          Back to kick-off
        </button>
      </main>
    )
  }
}
