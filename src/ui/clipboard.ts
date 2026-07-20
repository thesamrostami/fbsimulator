/**
 * Copy text to the clipboard as robustly as a browser allows.
 *
 * The async Clipboard API is the happy path, but it is blocked in a surprising
 * number of mobile situations — non-secure contexts, in-app webviews (the
 * LinkedIn/Instagram browsers people will open this from), and permission
 * policies. So we fall back to the legacy `execCommand('copy')` path, which
 * still works inside a user gesture almost everywhere. Returns whether the copy
 * actually succeeded, so callers can reveal a manual-select fallback when it
 * did not.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy path below.
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}
