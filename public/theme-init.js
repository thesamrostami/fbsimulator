// Applies the saved (or system) colour theme before the first paint, so a
// light-mode reader never sees a dark flash. Mirrors src/ui/themeMode.tsx;
// shipped as a separate file because the deploy CSP forbids inline scripts.
;(function () {
  var mode = 'system'
  try {
    var stored = window.localStorage.getItem('replay-cup-theme')
    if (stored === 'light' || stored === 'dark' || stored === 'system') mode = stored
  } catch {
    // Storage unavailable: fall back to the system preference.
  }
  var theme = mode
  if (mode === 'system') {
    theme =
      window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  var root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme
  var meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f3f6f1' : '#050d09')
})()
