import { useEffect, useRef } from 'react'

type Axis = 'x' | 'y'

/**
 * Marks a scroll container with `data-fade-start` / `data-fade-end` whenever
 * there is hidden content in that direction, so CSS can render a fade edge.
 *
 * This is the touch affordance for our hover-only internal scrollbars: on a
 * phone the native scrollbar is invisible (and iOS ignores styled scrollbars
 * on inner scrollers entirely), so the fade is the only "there's more" cue.
 * Pass anything that changes the content length as `deps` so the edges
 * re-evaluate when the list grows or the container resizes.
 */
export function useScrollFade<T extends HTMLElement>(axis: Axis = 'y', deps: unknown[] = []) {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const [pos, size, client] =
        axis === 'y'
          ? [el.scrollTop, el.scrollHeight, el.clientHeight]
          : [el.scrollLeft, el.scrollWidth, el.clientWidth]
      const max = size - client
      el.toggleAttribute('data-fade-start', pos > 1)
      el.toggleAttribute('data-fade-end', max > 1 && pos < max - 1)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    // ResizeObserver is absent in jsdom (tests); the scroll listener still works.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [axis, ...deps])
  return ref
}
