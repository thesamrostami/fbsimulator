import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { GOAL, makePitchTexture, type PitchLook } from './pitchTexture'
import { PITCH } from './terrainModel'


/**
 * The football ground the 3D views share: a procedural pitch texture (mown
 * stripes + markings, drawn once to a canvas) on a plane, with goal frames
 * and nets at both ends. Pure scenery — no match data.
 */

function GoalFrame({ end }: { end: -1 | 1 }) {
  const post = '#e8eee9'
  const r = 0.07
  const { width, height, depth } = GOAL
  return (
    <group position={[(end * PITCH.len) / 2, 0, 0]}>
      {[-1, 1].map((zs) => (
        <mesh key={zs} position={[0, height / 2, (zs * width) / 2]}>
          <cylinderGeometry args={[r, r, height, 8]} />
          <meshStandardMaterial color={post} roughness={0.5} emissive={post} emissiveIntensity={0.12} />
        </mesh>
      ))}
      <mesh position={[0, height, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[r, r, width, 8]} />
        <meshStandardMaterial color={post} roughness={0.5} emissive={post} emissiveIntensity={0.12} />
      </mesh>
      {/* Net: back and top panels as fine wireframe grids. */}
      <mesh position={[end * depth, height / 2, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[width, height, 14, 6]} />
        <meshBasicMaterial color="#dfe8e2" wireframe transparent opacity={0.28} />
      </mesh>
      <mesh position={[(end * depth) / 2, height, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[depth, width, 3, 14]} />
        <meshBasicMaterial color="#dfe8e2" wireframe transparent opacity={0.22} />
      </mesh>
      {[-1, 1].map((zs) => (
        <mesh key={`side-${zs}`} position={[(end * depth) / 2, height / 2, (zs * width) / 2]}>
          <planeGeometry args={[depth, height, 3, 6]} />
          <meshBasicMaterial color="#dfe8e2" wireframe transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

export function Pitch({ look }: { look: PitchLook }) {
  const tex = useMemo(() => makePitchTexture(look), [look])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[PITCH.len, PITCH.wid]} />
        <meshStandardMaterial map={tex} roughness={0.95} metalness={0} />
      </mesh>
      {/* A hair of surround so the touchline never reads as the edge of the world. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
        <planeGeometry args={[PITCH.len + 3, PITCH.wid + 3]} />
        <meshStandardMaterial color={look.grassB} roughness={1} />
      </mesh>
      <GoalFrame end={-1} />
      <GoalFrame end={1} />
    </group>
  )
}

/** Standard lighting rig for the pitch views. */
export function PitchLights() {
  return (
    <>
      <ambientLight intensity={0.45} />
      <hemisphereLight args={['#e2ebff', '#0a1410', 0.5]} />
      <directionalLight position={[13, 24, 10]} intensity={1.5} />
      <directionalLight position={[-16, 9, -12]} intensity={0.5} color="#8aa2ff" />
      <directionalLight position={[0, 6, -18]} intensity={0.3} color="#c9d6ff" />
    </>
  )
}
