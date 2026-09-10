import { ContactShadows, Html, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { memo, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import * as THREE from 'three'
import { teamHex, type TeamInfo } from '../../data/teams'
import { isShotEvent, type LineupSnapshot, type MatchEvent, type PossessionSequence, type RosterEntry, type Side } from '../../engine/types'
import { useTheme } from '../../ui/themeState'
import {
  ballAt,
  ballFrameOf,
  playerTargets,
  rosterAt,
  shotOutcomes,
  toWorld,
  type Roster,
  type ShotOutcome,
} from './livePitchModel'
import { Pitch, PitchLights } from './pitchScene'
import { PITCH_LOOK } from './pitchTexture'
import { PITCH } from './terrainModel'

/**
 * The live 3D pitch: 22 player pucks in their formations, a ball that
 * travels the engine's actual pass chains, shots that fly at the goal and
 * end the way the engine said they did, cards over the players who earned
 * them. Everything is driven by the match playhead (a ref, so scrubbing
 * costs no React renders) and positions ease toward their targets so the
 * teams flow rather than teleport.
 */

const PUCK_RADIUS = 0.56
const PUCK_HEIGHT = 0.16
const BALL_RADIUS = 0.22
/** Ease rate per second for player movement. */
const PLAYER_EASE = 5.5
/** Match minutes a card marker floats above a player (about 2 s at 1x). */
const CARD_LINGER_MINUTES = 6

// ── Number badges ───────────────────────────────────────────────────────────

const badgeCache = new Map<string, THREE.CanvasTexture>()

function contrastInk(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return lum > 0.6 ? '#0b1a12' : '#ffffff'
}

/** A circular shirt-number badge texture, cached per colour + number. */
function numberBadge(number: number, hex: string): THREE.CanvasTexture {
  const key = `${hex}-${number}`
  const cached = badgeCache.get(key)
  if (cached) return cached
  const S = 128
  const cv = document.createElement('canvas')
  cv.width = S
  cv.height = S
  const g = cv.getContext('2d')!
  g.clearRect(0, 0, S, S)
  g.fillStyle = hex
  g.beginPath()
  g.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2)
  g.fill()
  g.lineWidth = 6
  g.strokeStyle = 'rgba(255,255,255,0.85)'
  g.stroke()
  g.fillStyle = contrastInk(hex)
  g.font = `900 ${number >= 10 ? 60 : 68}px "Arial Narrow", "Roboto Condensed", system-ui, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(String(number), S / 2, S / 2 + 4)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  badgeCache.set(key, tex)
  return tex
}

// ── Actors: pucks, ball, pass line, cards — one per-frame director ──────────

interface Puck {
  group: THREE.Group
  ring: THREE.Mesh
  card: THREE.Mesh
  side: Side
}

interface ActorsProps {
  roster: Roster
  sequences: PossessionSequence[]
  outcomes: Map<number, ShotOutcome>
  cardsByPlayer: Map<string, { minute: number; red: boolean }[]>
  goals: { minute: number; side: Side; world: { x: number; z: number }; hex: string }[]
  minuteRef: MutableRefObject<number>
  hex: Record<Side, string>
  hovered: string | null
  focus: string | null
  onHover: (id: string | null) => void
  onSelect: (id: string | null) => void
  reducedMotion: boolean
}

const Actors = memo(function Actors({ roster, sequences, outcomes, cardsByPlayer, goals, minuteRef, hex, hovered, focus, onHover, onSelect, reducedMotion }: ActorsProps) {
  const pucks = useRef(new Map<string, Puck>())
  const ballRef = useRef<THREE.Group>(null)
  const shadowRef = useRef<THREE.Mesh>(null)
  const floodRef = useRef<THREE.Mesh>(null)
  const floodStart = useRef<{ at: number; hex: string } | null>(null)
  const lastMinute = useRef(-1)
  const lineGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    return g
  }, [])
  const lineObject = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false })
    const line = new THREE.Line(lineGeometry, mat)
    line.visible = false
    line.frustumCulled = false
    return line
  }, [lineGeometry])
  useEffect(
    () => () => {
      lineGeometry.dispose()
      ;(lineObject.material as THREE.Material).dispose()
    },
    [lineGeometry, lineObject],
  )
  const register = useCallback((id: string, puck: Puck | null) => {
    if (puck) pucks.current.set(id, puck)
    else pucks.current.delete(id)
  }, [])

  const entries = useMemo(
    () => [...roster.home.map((p) => ({ p, side: 'home' as const })), ...roster.away.map((p) => ({ p, side: 'away' as const }))],
    [roster],
  )

  useFrame((_, dt) => {
    const minute = minuteRef.current
    const ball = ballAt(sequences, outcomes, minute)
    const frame = ballFrameOf(ball, minute)
    const targets = playerTargets(roster, ball, minute, frame)
    const scrubbed = Math.abs(minute - lastMinute.current) > 1.5
    const ease = scrubbed ? 1 : 1 - Math.exp(-PLAYER_EASE * Math.min(dt, 0.1))
    for (const t of targets) {
      const puck = pucks.current.get(t.playerId)
      if (!puck) continue
      const isCarrier = ball.playerId === t.playerId && ball.action !== 'dead'
      // The man on the ball stands a touch behind it, so the ball shows.
      const tx = isCarrier ? t.world.x - Math.sign(t.world.x || 1) * 0.02 : t.world.x
      puck.group.position.x += (tx - puck.group.position.x) * ease
      puck.group.position.z += (t.world.z - puck.group.position.z) * ease
      puck.ring.visible = isCarrier || t.playerId === hovered || t.playerId === focus
      ;(puck.ring.material as THREE.MeshBasicMaterial).opacity = isCarrier ? 0.9 : 0.6
      // Cards float above the player for a moment after they are shown.
      const cards = cardsByPlayer.get(t.playerId)
      let showCard = false
      if (cards) {
        for (const c of cards) {
          if (minute >= c.minute && minute - c.minute < CARD_LINGER_MINUTES) {
            showCard = true
            ;(puck.card.material as THREE.MeshBasicMaterial).color.set(c.red ? '#e5484d' : '#f5c518')
          }
        }
      }
      puck.card.visible = showCard
      if (showCard) puck.card.position.y = PUCK_HEIGHT + 0.9 + Math.sin(minute * 40) * 0.05
    }

    if (ballRef.current) {
      ballRef.current.position.set(ball.world.x, BALL_RADIUS + ball.y, ball.world.z)
      // Roll while it travels.
      if (!reducedMotion && ball.progress < 1 && ball.action !== 'dead') ballRef.current.rotation.z -= 0.25
    }
    if (shadowRef.current) {
      shadowRef.current.position.set(ball.world.x, 0.015, ball.world.z)
      const s = 1 - Math.min(ball.y / 2.5, 0.6)
      shadowRef.current.scale.set(s, s, s)
      ;(shadowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * s
    }
    // Pass / shot line from where the ball left to where it is now.
    {
      const inFlight = ball.segmentFrom && ball.progress < 1 && ball.action !== 'carry' && ball.action !== 'restart' && ball.action !== 'end'
      lineObject.visible = Boolean(inFlight)
      if (inFlight && ball.segmentFrom) {
        const arr = lineGeometry.attributes.position.array as Float32Array
        arr[0] = ball.segmentFrom.x
        arr[1] = 0.08
        arr[2] = ball.segmentFrom.z
        arr[3] = ball.world.x
        arr[4] = 0.08 + ball.y
        arr[5] = ball.world.z
        lineGeometry.attributes.position.needsUpdate = true
        const mat = lineObject.material as THREE.LineBasicMaterial
        mat.color.set(hex[ball.side])
        mat.opacity = ball.action === 'shot' ? 0.9 : 0.55
      }
    }
    // Goal flood: an expanding ring at the goal mouth when the playhead crosses a goal.
    if (!reducedMotion && minute > lastMinute.current && minute - lastMinute.current < 1.5) {
      for (const g of goals) {
        if (g.minute > lastMinute.current && g.minute <= minute) {
          floodStart.current = { at: performance.now() / 1000, hex: g.hex }
          floodRef.current?.position.set(g.world.x, 0.05, g.world.z)
        }
      }
    }
    if (floodRef.current) {
      const f = floodStart.current
      const life = 1.8
      const el = f ? performance.now() / 1000 - f.at : life
      if (f && el < life) {
        const s = el / life
        floodRef.current.visible = true
        const scale = 1 + s * 7
        floodRef.current.scale.set(scale, scale, scale)
        const mat = floodRef.current.material as THREE.MeshBasicMaterial
        mat.color.set(f.hex)
        mat.opacity = (1 - s) * 0.7
      } else {
        floodRef.current.visible = false
      }
    }
    lastMinute.current = minute
  })

  return (
    <>
      {entries.map(({ p, side }) => (
        <PuckMesh
          key={p.playerId}
          entry={p}
          side={side}
          hex={hex[side]}
          register={register}
          hovered={hovered === p.playerId}
          focused={focus === p.playerId}
          onHover={onHover}
          onSelect={onSelect}
        />
      ))}
      <group ref={ballRef}>
        <mesh>
          <sphereGeometry args={[BALL_RADIUS, 20, 16]} />
          <meshStandardMaterial color="#f7f9f6" roughness={0.35} metalness={0.05} />
        </mesh>
        <mesh rotation-y={Math.PI / 3}>
          <torusGeometry args={[BALL_RADIUS * 0.72, 0.02, 6, 24]} />
          <meshBasicMaterial color="#1c2a22" />
        </mesh>
      </group>
      <mesh ref={shadowRef} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[BALL_RADIUS * 1.1, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <primitive object={lineObject} />
      <mesh ref={floodRef} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.7, 1.0, 40]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </>
  )
})

interface PuckMeshProps {
  entry: RosterEntry
  side: Side
  hex: string
  register: (id: string, puck: Puck | null) => void
  hovered: boolean
  focused: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string | null) => void
}

const PuckMesh = memo(function PuckMesh({ entry, side, hex, register, hovered, focused, onHover, onSelect }: PuckMeshProps) {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Mesh>(null)
  const card = useRef<THREE.Mesh>(null)
  const badge = useMemo(() => numberBadge(entry.shirtNumber, hex), [entry.shirtNumber, hex])

  useEffect(() => {
    if (group.current && ring.current && card.current) {
      register(entry.playerId, { group: group.current, ring: ring.current, card: card.current, side })
    }
    return () => register(entry.playerId, null)
  }, [register, side, entry.playerId])

  return (
    <group ref={group} position={[0, 0, 0]}>
      <mesh
        position={[0, PUCK_HEIGHT / 2, 0]}
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(entry.playerId)
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(focused ? null : entry.playerId)
        }}
      >
        <cylinderGeometry args={[PUCK_RADIUS, PUCK_RADIUS * 1.06, PUCK_HEIGHT, 28]} />
        <meshStandardMaterial color={hex} roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh position={[0, PUCK_HEIGHT + 0.006, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[PUCK_RADIUS * 0.92, 28]} />
        <meshBasicMaterial map={badge} transparent />
      </mesh>
      <mesh ref={ring} position={[0, 0.02, 0]} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[PUCK_RADIUS * 1.25, PUCK_RADIUS * 1.5, 32]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <mesh ref={card} position={[0, PUCK_HEIGHT + 0.9, 0]} visible={false}>
        <boxGeometry args={[0.36, 0.5, 0.05]} />
        <meshBasicMaterial color="#f5c518" />
      </mesh>
      {(hovered || focused) && (
        <Html position={[0, PUCK_HEIGHT + 0.5, 0]} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
          <div
            className="whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest"
            style={{ background: 'var(--color-night-2)', color: 'var(--color-floodlight)', borderColor: hex, boxShadow: `0 0 12px color-mix(in srgb, ${hex} 40%, transparent)` }}
          >
            <span style={{ color: hex }}>{entry.shirtNumber}</span> {entry.name} · {entry.label}
          </div>
        </Html>
      )}
    </group>
  )
})

// ── Shot map overlay ────────────────────────────────────────────────────────

const ShotMap = memo(function ShotMap({ events, shownMinute, hex }: { events: MatchEvent[]; shownMinute: number; hex: Record<Side, string> }) {
  const shots = useMemo(
    () => events.filter((e) => isShotEvent(e) && e.spot && e.side && e.minute <= shownMinute),
    [events, shownMinute],
  )
  return (
    <>
      {shots.map((e, i) => {
        const w = toWorld(e.spot!, e.side as Side, e.minute)
        const r = 0.16 + (e.xg ?? 0) * 0.9
        const goal = e.type === 'goal'
        return (
          <group key={`${e.minute}-${i}`} position={[w.x, 0.03, w.z]}>
            <mesh rotation-x={-Math.PI / 2}>
              <circleGeometry args={[r, 24]} />
              <meshBasicMaterial color={hex[e.side as Side]} transparent opacity={goal ? 0.95 : 0.45} depthWrite={false} />
            </mesh>
            {goal && (
              <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 0]}>
                <ringGeometry args={[r + 0.06, r + 0.14, 24]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
              </mesh>
            )}
          </group>
        )
      })}
    </>
  )
})

// ── The component ───────────────────────────────────────────────────────────

export interface LivePitchProps {
  sequences: PossessionSequence[]
  events: MatchEvent[]
  lineupLog: LineupSnapshot[]
  /** Playhead, fractional minutes. */
  minute: number
  duration: number
  home: TeamInfo
  away: TeamInfo
  reducedMotion?: boolean
  /** Slow turntable for the finished-match replay. */
  autoRotate?: boolean
  showShotMap?: boolean
  /** Pinned player (tap a puck); reported back through onSelect. */
  focus?: string | null
  onSelect?: (playerId: string | null) => void
  onHover?: (playerId: string | null) => void
}

export function LivePitch({
  sequences,
  events,
  lineupLog,
  minute,
  duration,
  home,
  away,
  reducedMotion = false,
  autoRotate = false,
  showShotMap = false,
  focus = null,
  onSelect,
  onHover,
}: LivePitchProps) {
  const { theme } = useTheme()
  const hex = useMemo<Record<Side, string>>(
    () => ({ home: teamHex(home.id, theme).accent, away: teamHex(away.id, theme).accent }),
    [home.id, away.id, theme],
  )
  const minuteRef = useRef(minute)
  minuteRef.current = minute
  const shownMinute = Math.floor(Math.min(minute, duration))
  const [hovered, setHovered] = useState<string | null>(null)

  const roster = useMemo(() => rosterAt(lineupLog, events, shownMinute), [lineupLog, events, shownMinute])
  const outcomes = useMemo(() => shotOutcomes(events), [events])
  const cardsByPlayer = useMemo(() => {
    const map = new Map<string, { minute: number; red: boolean }[]>()
    for (const e of events) {
      if ((e.type === 'yellow-card' || e.type === 'red-card') && e.player) {
        const list = map.get(e.player.id) ?? []
        list.push({ minute: e.minute, red: e.type === 'red-card' })
        map.set(e.player.id, list)
      }
    }
    return map
  }, [events])
  const goals = useMemo(
    () =>
      events
        .filter((e) => e.type === 'goal' && e.side)
        .map((e) => ({
          minute: e.minute,
          side: e.side as Side,
          world: toWorld({ x: 1, y: 0.5 }, e.side as Side, e.minute),
          hex: hex[e.side as Side],
        })),
    [events, hex],
  )

  const hover = useCallback(
    (id: string | null) => {
      setHovered(id)
      onHover?.(id)
    },
    [onHover],
  )
  const select = useCallback((id: string | null) => onSelect?.(id), [onSelect])

  return (
    <div className="relative h-full w-full">
      <Canvas
        orthographic
        camera={{ position: [17, 15, 21], zoom: 26, near: 0.1, far: 200 }}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <PitchLights />
        <Pitch look={PITCH_LOOK[theme]} />
        <Actors
          roster={roster}
          sequences={sequences}
          outcomes={outcomes}
          cardsByPlayer={cardsByPlayer}
          goals={goals}
          minuteRef={minuteRef}
          hex={hex}
          hovered={hovered}
          focus={focus}
          onHover={hover}
          onSelect={select}
          reducedMotion={reducedMotion}
        />
        {showShotMap && <ShotMap events={events} shownMinute={shownMinute} hex={hex} />}
        <ContactShadows position={[0, -0.02, 0]} scale={PITCH.len * 1.4} blur={2.2} opacity={0.4} far={6} resolution={512} color="#000000" />
        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minPolarAngle={0.2}
          maxPolarAngle={1.3}
          minZoom={12}
          maxZoom={60}
          autoRotate={autoRotate && !reducedMotion}
          autoRotateSpeed={0.4}
        />
      </Canvas>

      {/* Legend + attack directions, in DOM so it stays crisp and themed. */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 text-[11px] font-semibold text-floodlight/85">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: hex.home }} /> {home.shortName}{' '}
          {attacksRight('home', shownMinute) ? '▸' : '◂'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: hex.away }} /> {away.shortName}{' '}
          {attacksRight('away', shownMinute) ? '▸' : '◂'}
        </span>
      </div>
    </div>
  )
}

function attacksRight(side: Side, minute: number): boolean {
  return toWorld({ x: 1, y: 0.5 }, side, Math.max(minute, 1)).x > 0
}
