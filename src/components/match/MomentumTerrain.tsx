import { ContactShadows, Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import * as THREE from 'three'
import type { MatchEvent, MomentumTimelinePoint } from '../../engine/types'
import { useTheme } from '../../ui/themeState'
import { Pitch, PitchLights } from './pitchScene'
import { PITCH_LOOK } from './pitchTexture'
import { buildPitchModel, momentumInterp, PITCH, sampleField, type PitchModel, type TerrainPin } from './terrainModel'

/**
 * The floating 3D pitch-terrain. A football ground hangs in the dark void; each
 * team's attacking threat rises as coloured terrain massing in the third it is
 * attacking (home → +X, away → −X), growing with the SAME match playhead. The
 * heightfield is recomputed on the CPU each frame from the revealed shots plus
 * a momentum swell; the only shader touch is a one-line discard so the pitch
 * shows through wherever the terrain is flat. Colours arrive as real hex
 * values (the caller resolves the team variables for the active theme).
 */

function hexToLinear(hex: string): [number, number, number] {
  const c = new THREE.Color(hex)
  return [c.r, c.g, c.b]
}

function Terrain({
  model,
  homeColor,
  awayColor,
  minuteRef,
  growMin,
}: {
  model: PitchModel
  homeColor: string
  awayColor: string
  minuteRef: MutableRefObject<number>
  growMin: number
}) {
  const homeLin = useMemo(() => hexToLinear(homeColor), [homeColor])
  const awayLin = useMemo(() => hexToLinear(awayColor), [awayColor])

  // Flat grid in XZ; Y + colour are rewritten every frame from the revealed field.
  const { geometry, baseXZ } = useMemo(() => {
    const nx = PITCH.gridX
    const nz = PITCH.gridZ
    const vcount = (nx + 1) * (nz + 1)
    const positions = new Float32Array(vcount * 3)
    const colors = new Float32Array(vcount * 3)
    const base = new Float32Array(vcount * 2)
    for (let ix = 0; ix <= nx; ix++) {
      for (let iz = 0; iz <= nz; iz++) {
        const i = ix * (nz + 1) + iz
        const x = -PITCH.len / 2 + (ix / nx) * PITCH.len
        const z = -PITCH.wid / 2 + (iz / nz) * PITCH.wid
        positions[i * 3] = x
        positions[i * 3 + 1] = PITCH.y0
        positions[i * 3 + 2] = z
        base[i * 2] = x
        base[i * 2 + 1] = z
      }
    }
    const indices = new Uint32Array(nx * nz * 6)
    let k = 0
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const a = ix * (nz + 1) + iz
        const b = a + (nz + 1)
        indices[k++] = a
        indices[k++] = b
        indices[k++] = a + 1
        indices[k++] = b
        indices[k++] = b + 1
        indices[k++] = a + 1
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.setIndex(new THREE.BufferAttribute(indices, 1))
    g.computeVertexNormals()
    return { geometry: g, baseXZ: base }
  }, [])

  const material = useMemo(() => {
    // Translucent "fabric" over the pitch: flat where the sheets are thin (the
    // green ground reads through), opaque where the push-wave and shot peaks
    // rise, so height alone tells you where the action is.
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.45,
      metalness: 0.0,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
    })
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vTerr;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerr = transformed.y;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vTerr;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a = mix(0.24, 0.96, smoothstep(0.4, 2.2, vTerr));')
        // The push-wave and shot peaks self-illuminate in their team colour.
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * smoothstep(1.3, 4.5, vTerr) * 0.75;')
    }
    return mat
  }, [])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  const lastMinute = useRef(-1)
  useFrame(() => {
    const minute = minuteRef.current
    // Paused/idle: the field is a pure function of the minute, so nothing to
    // recompute — orbit stays smooth for free.
    if (minute === lastMinute.current) return
    lastMinute.current = minute
    const mom01 = momentumInterp(model.perMinute, minute) / 100
    const pos = geometry.attributes.position as THREE.BufferAttribute
    const col = geometry.attributes.color as THREE.BufferAttribute
    const parr = pos.array as Float32Array
    const carr = col.array as Float32Array
    const n = baseXZ.length / 2
    for (let i = 0; i < n; i++) {
      const x = baseXZ[i * 2]
      const z = baseXZ[i * 2 + 1]
      const { height, mix } = sampleField(model.bumps, x, z, minute, mom01, growMin)
      parr[i * 3 + 1] = PITCH.y0 + height
      carr[i * 3] = awayLin[0] + (homeLin[0] - awayLin[0]) * mix
      carr[i * 3 + 1] = awayLin[1] + (homeLin[1] - awayLin[1]) * mix
      carr[i * 3 + 2] = awayLin[2] + (homeLin[2] - awayLin[2]) * mix
    }
    pos.needsUpdate = true
    col.needsUpdate = true
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} position={[0, 0, 0]} castShadow />
}

/** Expanding emissive rings when the playhead crosses a goal — the "flood". */
function GoalFloods({
  goals,
  minuteRef,
  reducedMotion,
}: {
  goals: TerrainPin[]
  minuteRef: MutableRefObject<number>
  reducedMotion: boolean
}) {
  const POOL = 5
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const slots = useRef(goals.map(() => -1)) // per-goal → pool index while active
  const active = useRef<{ start: number; color: THREE.Color; x: number; z: number; mesh: number }[]>([])
  const prev = useRef(0)
  const next = useRef(0)

  useFrame(() => {
    const minute = minuteRef.current
    if (!reducedMotion && minute > prev.current && minute - prev.current < 2) {
      goals.forEach((gPin, gi) => {
        if (gPin.minute > prev.current && gPin.minute <= minute && slots.current[gi] < 0) {
          const slot = next.current % POOL
          next.current++
          slots.current[gi] = slot
          active.current = active.current.filter((a) => a.mesh !== slot)
          active.current.push({ start: performance.now() / 1000, color: new THREE.Color(gPin.color), x: gPin.x, z: gPin.z, mesh: slot })
        }
      })
    }
    prev.current = minute
    // Reset all meshes hidden, then drive the active ones.
    for (const mm of meshes.current) if (mm) mm.visible = false
    active.current = active.current.filter((a) => {
      const el = performance.now() / 1000 - a.start
      const life = 1.7
      if (el > life) return false
      const mm = meshes.current[a.mesh]
      if (!mm) return true
      const s = el / life
      mm.visible = true
      mm.position.set(a.x, 0.06, a.z)
      const scale = 1 + s * 7
      mm.scale.set(scale, scale, scale)
      const mat = mm.material as THREE.MeshBasicMaterial
      mat.color.copy(a.color)
      mat.opacity = (1 - s) * 0.6
      return true
    })
  })

  return (
    <>
      {Array.from({ length: POOL }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshes.current[i] = el
          }}
          rotation-x={-Math.PI / 2}
          visible={false}
        >
          <ringGeometry args={[0.7, 1.0, 40]} />
          <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}

const Pins = memo(function Pins({ pins, shownMinute }: { pins: TerrainPin[]; shownMinute: number }) {
  return (
    <>
      {pins
        .filter((p) => p.minute <= shownMinute)
        .map((p, i) => (
          <Html key={`${p.minute}-${i}`} position={[p.x, 2.5, p.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                whiteSpace: 'nowrap',
                fontFamily: 'inherit',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: 999,
                color: 'var(--color-floodlight)',
                background: 'var(--color-night-2)',
                border: `1px solid ${p.color}`,
                boxShadow: `0 0 12px color-mix(in srgb, ${p.color} 40%, transparent)`,
              }}
            >
              <span style={{ color: p.color }}>{p.kind === 'goal' ? '⚽' : '🟥'}</span>
              <span>{p.detail}</span>
            </div>
          </Html>
        ))}
    </>
  )
})

const Scene = memo(function Scene({
  model,
  homeColor,
  awayColor,
  minuteRef,
  shownMinute,
  growMin,
  reducedMotion,
  autoRotate,
}: {
  model: PitchModel
  homeColor: string
  awayColor: string
  minuteRef: MutableRefObject<number>
  shownMinute: number
  growMin: number
  reducedMotion: boolean
  autoRotate: boolean
}) {
  const goals = useMemo(() => model.pins.filter((p) => p.kind === 'goal'), [model])
  const { theme } = useTheme()
  return (
    <>
      <PitchLights />
      <Pitch look={PITCH_LOOK[theme]} />
      <Terrain model={model} homeColor={homeColor} awayColor={awayColor} minuteRef={minuteRef} growMin={growMin} />
      <GoalFloods goals={goals} minuteRef={minuteRef} reducedMotion={reducedMotion} />
      <Pins pins={model.pins} shownMinute={shownMinute} />
      <ContactShadows position={[0, -0.05, 0]} scale={PITCH.len * 1.5} blur={2.6} opacity={0.42} far={20} resolution={512} color="#000000" />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minPolarAngle={0.25}
        maxPolarAngle={1.35}
        minZoom={12}
        maxZoom={52}
        autoRotate={autoRotate && !reducedMotion}
        autoRotateSpeed={0.45}
      />
    </>
  )
})

export interface MomentumTerrainProps {
  momentumTimeline: MomentumTimelinePoint[]
  events: MatchEvent[]
  minute: number
  homeColor: string
  awayColor: string
  homeName: string
  awayName: string
  duration: number
  reducedMotion?: boolean
  /** Slow turntable rotation — used for the finished-match replay showcase. */
  autoRotate?: boolean
}

export function MomentumTerrain({
  momentumTimeline,
  events,
  minute,
  homeColor,
  awayColor,
  homeName,
  awayName,
  duration,
  reducedMotion = false,
  autoRotate = false,
}: MomentumTerrainProps) {
  const minuteRef = useRef(minute)
  minuteRef.current = minute
  const shownMinute = Math.floor(Math.min(minute, duration))

  const model = useMemo(
    () => buildPitchModel(momentumTimeline, events, homeColor, awayColor),
    [momentumTimeline, events, homeColor, awayColor],
  )
  const growMin = reducedMotion ? 0.001 : PITCH.growMin

  return (
    <div className="relative h-full w-full">
      <Canvas
        orthographic
        camera={{ position: [17, 15, 21], zoom: 24, near: 0.1, far: 200 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <Scene
          model={model}
          homeColor={homeColor}
          awayColor={awayColor}
          minuteRef={minuteRef}
          shownMinute={shownMinute}
          growMin={growMin}
          reducedMotion={reducedMotion}
          autoRotate={autoRotate}
        />
      </Canvas>

      {/* Team legend + attack direction. */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 text-[11px] font-semibold text-floodlight/80">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: homeColor }} /> {homeName} ▸
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: awayColor }} /> ◂ {awayName}
        </span>
      </div>
    </div>
  )
}
