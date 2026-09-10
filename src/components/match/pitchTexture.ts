import * as THREE from 'three'
import { PITCH } from './terrainModel'

/** Looks, dimensions and the procedural texture behind the shared 3D pitch. */

export interface PitchLook {
  grassA: string
  grassB: string
  line: string
}

export const PITCH_LOOK: Record<'dark' | 'light', PitchLook> = {
  dark: { grassA: '#124d27', grassB: '#0f4322', line: 'rgba(233,240,234,0.82)' },
  light: { grassA: '#2f9a55', grassB: '#2a8c4c', line: 'rgba(255,255,255,0.92)' },
}

/** Procedural pitch texture: mown stripes + white markings, drawn once. */
export function makePitchTexture(look: PitchLook): THREE.CanvasTexture {
  const W = 1024
  const H = Math.round((W * PITCH.wid) / PITCH.len)
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const g = cv.getContext('2d')!
  const stripes = 14
  for (let i = 0; i < stripes; i++) {
    g.fillStyle = i % 2 === 0 ? look.grassA : look.grassB
    g.fillRect((i * W) / stripes, 0, W / stripes + 1, H)
  }
  const m = W * 0.03 // margin
  g.strokeStyle = look.line
  g.lineWidth = Math.max(2, H * 0.007)
  const line = (fn: () => void) => {
    g.beginPath()
    fn()
    g.stroke()
  }
  line(() => g.rect(m, m, W - 2 * m, H - 2 * m))
  line(() => {
    g.moveTo(W / 2, m)
    g.lineTo(W / 2, H - m)
  })
  line(() => g.arc(W / 2, H / 2, H * 0.13, 0, Math.PI * 2))
  g.fillStyle = look.line
  g.beginPath()
  g.arc(W / 2, H / 2, H * 0.012, 0, Math.PI * 2)
  g.fill()
  const penW = W * 0.15
  const penH = H * 0.6
  const sixW = W * 0.06
  const sixH = H * 0.3
  for (const side of [-1, 1] as const) {
    const goalX = side < 0 ? m : W - m
    const dir = side < 0 ? 1 : -1
    line(() => g.rect(goalX, (H - penH) / 2, dir * penW, penH))
    line(() => g.rect(goalX, (H - sixH) / 2, dir * sixW, sixH))
    const spotX = goalX + dir * penW * 0.72
    g.beginPath()
    g.arc(spotX, H / 2, H * 0.012, 0, Math.PI * 2)
    g.fill()
    const a0 = side < 0 ? -0.9 : Math.PI - 0.9
    const a1 = side < 0 ? 0.9 : Math.PI + 0.9
    line(() => g.arc(spotX, H / 2, H * 0.13, a0, a1))
  }
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/** Goal mouth: width and height in world units (7.32 m × 2.44 m at pitch scale). */
export const GOAL = { width: (7.32 / 68) * PITCH.wid, height: (2.44 / 68) * PITCH.wid, depth: 0.7 } as const

