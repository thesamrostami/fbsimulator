import type { MonteCarloResult } from '../engine/types'
import type { McRequest, McResponse } from './monteCarlo.worker'

/**
 * Sends Monte Carlo requests to the worker and resolves them by id. Where
 * Workers are unavailable (tests, very old browsers) the same work runs in
 * this thread, so callers never need to know.
 */

let worker: Worker | null | undefined
let nextId = 1
const pending = new Map<number, { resolve: (r: MonteCarloResult) => void; reject: (e: Error) => void }>()

function getWorker(): Worker | null {
  if (worker !== undefined) return worker
  try {
    if (typeof Worker === 'undefined') {
      worker = null
    } else {
      worker = new Worker(new URL('./monteCarlo.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<McResponse>) => {
        const entry = pending.get(event.data.id)
        if (!entry) return
        pending.delete(event.data.id)
        if ('error' in event.data) entry.reject(new Error(event.data.error))
        else entry.resolve(event.data.result)
      }
      worker.onerror = () => {
        // The worker died: fail everything in flight and fall back to in-thread work from now on.
        for (const entry of pending.values()) entry.reject(new Error('Monte Carlo worker failed'))
        pending.clear()
        worker?.terminate()
        worker = null
      }
    }
  } catch {
    worker = null
  }
  return worker
}

async function inThread(request: McRequest): Promise<MonteCarloResult> {
  // Yield once so a pressed button can paint its loading state first.
  await new Promise((resolve) => setTimeout(resolve, 0))
  const { serve } = await import('./monteCarlo.worker')
  return serve(request)
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never

/** Run one request, off the main thread when possible. */
export function requestMonteCarlo(request: DistributiveOmit<McRequest, 'id'>): Promise<MonteCarloResult> {
  const id = nextId++
  const full = { ...request, id } as McRequest
  const w = getWorker()
  if (!w) return inThread(full)
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    w.postMessage(full)
  })
}

/** Test hook: forget the worker so the next request creates (or falls back) afresh. */
export function resetMonteCarloClient(): void {
  worker?.terminate()
  worker = undefined
  pending.clear()
}
