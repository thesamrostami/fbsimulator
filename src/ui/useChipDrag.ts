import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { sameLocation, type ChipLocation } from '../state/appState'

/**
 * Pointer drag-and-drop for lineup chips, layered over tap-to-swap: press a
 * chip, move past the threshold and a ghost follows the pointer; release
 * over another chip to swap the two. Mouse and pen only — on touch the bench
 * scrolls, and the two-tap flow already works with one thumb.
 *
 * Drop targets are found by hit-testing `data-location` attributes under the
 * pointer (the ghost is pointer-events: none), so any chip anywhere in the
 * editor is a target without wiring per element.
 */

export const LOCATION_ATTR = 'data-location'
/** Pixels of movement before a press becomes a drag (a tap stays a tap). */
const DRAG_THRESHOLD = 6

export function locationAttr(loc: ChipLocation): string {
  return loc.kind === 'slot' ? `slot:${loc.slotId}` : `bench:${loc.index}`
}

export function parseLocation(value: string | null | undefined): ChipLocation | null {
  if (!value) return null
  const [kind, rest] = value.split(':')
  if (kind === 'slot' && rest) return { kind: 'slot', slotId: rest }
  if (kind === 'bench' && rest !== undefined && rest !== '') {
    const index = Number(rest)
    return Number.isInteger(index) ? { kind: 'bench', index } : null
  }
  return null
}

/** The chip location under a viewport point, if any (excluding the dragged one). */
export function targetAt(x: number, y: number, exclude: ChipLocation): ChipLocation | null {
  if (typeof document === 'undefined' || !document.elementFromPoint) return null
  const el = document.elementFromPoint(x, y)
  const host = el?.closest<HTMLElement>(`[${LOCATION_ATTR}]`)
  const loc = parseLocation(host?.getAttribute(LOCATION_ATTR))
  if (!loc || sameLocation(loc, exclude)) return null
  return loc
}

export interface DragState {
  from: ChipLocation
  x: number
  y: number
  over: ChipLocation | null
}

interface Pending {
  from: ChipLocation
  pointerId: number
  startX: number
  startY: number
  target: HTMLElement
}

export interface ChipDragHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void
}

export function useChipDrag(onDrop: (from: ChipLocation, to: ChipLocation) => void) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const pending = useRef<Pending | null>(null)
  const active = useRef<DragState | null>(null)
  const suppressClick = useRef(false)

  const reset = useCallback(() => {
    pending.current = null
    active.current = null
    setDrag(null)
  }, [])

  // A drag that ends outside the window (or the component unmounting) must not leave a ghost behind.
  useEffect(() => {
    const cancel = () => {
      if (active.current || pending.current) reset()
    }
    window.addEventListener('blur', cancel)
    return () => window.removeEventListener('blur', cancel)
  }, [reset])

  const handlersFor = useCallback(
    (from: ChipLocation, enabled = true): ChipDragHandlers => ({
      onPointerDown: (e) => {
        if (!enabled || e.button !== 0 || e.pointerType === 'touch') return
        pending.current = { from, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, target: e.currentTarget }
      },
      onPointerMove: (e) => {
        const p = pending.current
        if (p && !active.current && e.pointerId === p.pointerId) {
          if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < DRAG_THRESHOLD) return
          // Past the threshold: this press is a drag, not a tap.
          suppressClick.current = true
          try {
            p.target.setPointerCapture(p.pointerId)
          } catch {
            // jsdom and some browsers refuse capture; hit-testing still works.
          }
          active.current = { from: p.from, x: e.clientX, y: e.clientY, over: null }
        }
        const a = active.current
        if (!a || e.pointerId !== p?.pointerId) return
        const next = { ...a, x: e.clientX, y: e.clientY, over: targetAt(e.clientX, e.clientY, a.from) }
        active.current = next
        setDrag(next)
      },
      onPointerUp: (e) => {
        const a = active.current
        if (a && e.pointerId === pending.current?.pointerId) {
          const over = targetAt(e.clientX, e.clientY, a.from) ?? a.over
          if (over) onDrop(a.from, over)
        }
        reset()
      },
      onPointerCancel: () => reset(),
    }),
    [onDrop, reset],
  )

  /** True once, right after a drag: the click the browser fires on release must not count as a tap. */
  const consumeClick = useCallback((): boolean => {
    const suppressed = suppressClick.current
    suppressClick.current = false
    return suppressed
  }, [])

  return { drag, handlersFor, consumeClick }
}
