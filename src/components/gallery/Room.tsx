'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { MeshReflectorMaterial } from '@react-three/drei';
import { stoneFloorMaps, plasterMaps, oakMaps, softShadowTexture } from './textures';
import {
  ROOM_HEIGHT,
  ENTRANCE_Z,
  TRACK_OUT,
  TRACK_Y,
  SKIRTING_H,
  PICTURE_RAIL_Y,
  benchLayout,
  BENCH_HALF_X,
  BENCH_HALF_Z,
} from './dims';

/* --------------------------------- pieces -------------------------------- */

/** Viewing bench: oxblood leather pad on a dark oak plinth. */
function Bench({ x, z }: { x: number; z: number }) {
  const oak = oakMaps();
  return (
    <group position={[x, 0, z]}>
      {/* leather seat, lifted just proud of the plinth */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[BENCH_HALF_X * 2, 0.11, BENCH_HALF_Z * 2]} />
        <meshStandardMaterial color="#5b3a2e" roughness={0.58} metalness={0.04} />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[BENCH_HALF_X * 1.35, 0.4, BENCH_HALF_Z * 1.6]} />
        <meshStandardMaterial {...oak} roughness={0.6} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <boxGeometry args={[BENCH_HALF_X * 1.75, 0.06, BENCH_HALF_Z * 1.9]} />
        <meshStandardMaterial color="#2b211a" roughness={0.7} />
      </mesh>
      {/* the room's fill lights cast no shadows, so the bench gets a painted
          one — without it, it floats a centimetre above the floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <planeGeometry args={[BENCH_HALF_X * 3.6, BENCH_HALF_Z * 3.1]} />
        <meshBasicMaterial
          map={softShadowTexture()}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/** A run of lighting track with the rail the spots clip onto. */
function TrackRail({
  from,
  to,
  axis,
  fixed,
}: {
  from: number;
  to: number;
  axis: 'z' | 'x';
  fixed: number;
}) {
  const len = to - from;
  const mid = (from + to) / 2;
  const pos: [number, number, number] =
    axis === 'z' ? [fixed, TRACK_Y + 0.13, mid] : [mid, TRACK_Y + 0.13, fixed];
  const args: [number, number, number] =
    axis === 'z' ? [0.06, 0.07, len] : [len, 0.07, 0.06];
  return (
    <mesh position={pos}>
      <boxGeometry args={args} />
      <meshStandardMaterial color="#151416" roughness={0.4} metalness={0.75} />
    </mesh>
  );
}

/* ---------------------------------- room --------------------------------- */

/**
 * The architecture of the hall: honed limestone floor, plaster walls in a
 * period-tinted distemper, an oak skirting and picture rail, a coffered ceiling
 * with luminous laylight panels, lighting track down both sides, and an arched
 * doorway behind you so the room feels entered rather than spawned into.
 *
 * The visitor starts at the origin facing +z; the hero wall is at `length`.
 */
export default function Room({
  length,
  width = 8,
  height = ROOM_HEIGHT,
  accent = '#c9a25a',
}: {
  length: number;
  width?: number;
  height?: number;
  accent?: string;
}) {
  const halfW = width / 2;
  const startZ = ENTRANCE_Z;
  const depth = length - startZ;
  const midZ = (startZ + length) / 2;

  const stone = useMemo(() => stoneFloorMaps(), []);
  const plaster = useMemo(() => plasterMaps(), []);
  const oak = useMemo(() => oakMaps(), []);

  /**
   * Galleries are painted to flatter their pictures, so the wall takes a heavy
   * wash of the period's own colour — enough that a Baroque room reads warm-red
   * and an Impressionist one cool, without ever competing with the canvases.
   */
  const wallColor = useMemo(
    () => new THREE.Color(accent).lerp(new THREE.Color('#cdc5b4'), 0.76).getStyle(),
    [accent],
  );
  const coveColor = useMemo(
    () => new THREE.Color(accent).lerp(new THREE.Color('#ffd9a0'), 0.5),
    [accent],
  );

  // Laylight panels down the spine of the ceiling, with a coffer beam between.
  const bays = useMemo(() => {
    const out: number[] = [];
    const BAY = 4.6;
    const n = Math.max(1, Math.round(depth / BAY));
    const step = depth / n;
    for (let i = 0; i < n; i++) out.push(startZ + step * (i + 0.5));
    return { centres: out, step };
  }, [depth, startZ]);

  const benches = useMemo(() => benchLayout(length), [length]);

  // Doorway in the entrance wall.
  const DOOR_W = 2.8;
  const DOOR_H = 3.0;

  return (
    <group>
      {/* ------------------------------ floor ------------------------------ */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, midZ]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <MeshReflectorMaterial
          resolution={1024}
          mirror={0.32}
          mixStrength={0.9}
          mixBlur={6}
          blur={[420, 120]}
          depthScale={1.1}
          minDepthThreshold={0.25}
          maxDepthThreshold={1.4}
          color="#b0a89b"
          roughness={0.62}
          metalness={0.16}
          map={stone.map}
          roughnessMap={stone.roughnessMap}
          normalMap={stone.normalMap}
          normalScale={new THREE.Vector2(0.5, 0.5)}
        />
      </mesh>

      {/* ------------------------------ walls ------------------------------ */}
      {([-1, 1] as const).map((s) => (
        <mesh
          key={`wall${s}`}
          position={[s * halfW, height / 2, midZ]}
          rotation={[0, -s * (Math.PI / 2), 0]}
          receiveShadow
        >
          <planeGeometry args={[depth, height]} />
          <meshStandardMaterial
            color={wallColor}
            roughness={0.97}
            {...plaster}
            normalScale={new THREE.Vector2(0.35, 0.35)}
          />
        </mesh>
      ))}

      {/* end wall — the hero hangs here */}
      <mesh position={[0, height / 2, length]} receiveShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color={wallColor}
          roughness={0.97}
          {...plaster}
          normalScale={new THREE.Vector2(0.35, 0.35)}
        />
      </mesh>

      {/* Entrance wall, built around a doorway so the hall reads as entered.
          No Y rotation: a plane faces its local +z, and this wall has to face
          up the hall at the visitor or it back-face culls into nothing. */}
      <group position={[0, 0, startZ]}>
        {([-1, 1] as const).map((s) => (
          <mesh
            key={`ent${s}`}
            position={[(s * (width / 2 + DOOR_W / 2)) / 2, height / 2, 0]}
            receiveShadow
          >
            <planeGeometry args={[(width - DOOR_W) / 2, height]} />
            <meshStandardMaterial color={wallColor} roughness={0.97} {...plaster} />
          </mesh>
        ))}
        <mesh position={[0, (DOOR_H + height) / 2, 0]} receiveShadow>
          <planeGeometry args={[DOOR_W, height - DOOR_H]} />
          <meshStandardMaterial color={wallColor} roughness={0.97} {...plaster} />
        </mesh>
        {/* moulded architrave around the opening */}
        <mesh position={[0, DOOR_H + 0.06, 0.06]}>
          <boxGeometry args={[DOOR_W + 0.34, 0.12, 0.14]} />
          <meshStandardMaterial {...oak} roughness={0.5} metalness={0.2} />
        </mesh>
        {([-1, 1] as const).map((s) => (
          <mesh key={`arch${s}`} position={[s * (DOOR_W / 2 + 0.085), DOOR_H / 2, 0.06]}>
            <boxGeometry args={[0.17, DOOR_H, 0.14]} />
            <meshStandardMaterial {...oak} roughness={0.5} metalness={0.2} />
          </mesh>
        ))}
      </group>

      {/* A dim vestibule beyond the doorway, so it doesn't open onto the void.
          Boxed in on all four sides and lit low, it reads as the next room. */}
      <group>
        <mesh position={[0, height / 2, startZ - 5]}>
          <planeGeometry args={[width, height]} />
          <meshStandardMaterial color="#6b6357" roughness={1} />
        </mesh>
        {([-1, 1] as const).map((s) => (
          <mesh
            key={`vest${s}`}
            position={[s * (DOOR_W / 2 + 0.6), height / 2, startZ - 2.5]}
            rotation={[0, -s * (Math.PI / 2), 0]}
          >
            <planeGeometry args={[5, height]} />
            <meshStandardMaterial color="#6b6357" roughness={1} />
          </mesh>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, startZ - 2.5]}>
          <planeGeometry args={[DOOR_W + 1.2, 5]} />
          <meshStandardMaterial color="#4a443c" roughness={0.8} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, startZ - 2.5]}>
          <planeGeometry args={[DOOR_W + 1.2, 5]} />
          <meshStandardMaterial color="#2a2620" roughness={1} />
        </mesh>
        <pointLight
          position={[0, 2.9, startZ - 2.2]}
          intensity={26}
          distance={11}
          decay={2}
          color="#d8bf99"
        />
      </group>

      {/* --------------------------- skirting + rail ----------------------- */}
      {([-1, 1] as const).map((s) => (
        <group key={`trim${s}`}>
          <mesh position={[s * (halfW - 0.03), SKIRTING_H / 2, midZ]} receiveShadow castShadow>
            <boxGeometry args={[0.06, SKIRTING_H, depth]} />
            <meshStandardMaterial {...oak} roughness={0.55} metalness={0.15} />
          </mesh>
          {/* cap bead on top of the skirting */}
          <mesh position={[s * (halfW - 0.045), SKIRTING_H + 0.015, midZ]}>
            <boxGeometry args={[0.09, 0.03, depth]} />
            <meshStandardMaterial color="#8a7047" roughness={0.45} metalness={0.35} />
          </mesh>
          {/* picture rail */}
          <mesh position={[s * (halfW - 0.04), PICTURE_RAIL_Y, midZ]}>
            <boxGeometry args={[0.08, 0.07, depth]} />
            <meshStandardMaterial color="#7a6340" roughness={0.5} metalness={0.3} />
          </mesh>
        </group>
      ))}
      {/* the same trim across the end wall */}
      <mesh position={[0, SKIRTING_H / 2, length - 0.03]} receiveShadow>
        <boxGeometry args={[width, SKIRTING_H, 0.06]} />
        <meshStandardMaterial {...oak} roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh position={[0, PICTURE_RAIL_Y, length - 0.04]}>
        <boxGeometry args={[width, 0.07, 0.08]} />
        <meshStandardMaterial color="#7a6340" roughness={0.5} metalness={0.3} />
      </mesh>

      {/* ----------------------------- ceiling ----------------------------- */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, midZ]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#5d564c" roughness={0.95} />
      </mesh>

      {/* cove: a lip around the ceiling edge hiding an accent-coloured uplight */}
      {([-1, 1] as const).map((s) => (
        <group key={`cove${s}`}>
          <mesh position={[s * (halfW - 0.22), height - 0.24, midZ]}>
            <boxGeometry args={[0.44, 0.1, depth]} />
            <meshStandardMaterial color="#4a453d" roughness={0.9} />
          </mesh>
          <mesh position={[s * (halfW - 0.32), height - 0.17, midZ]}>
            <boxGeometry args={[0.22, 0.02, depth - 0.4]} />
            <meshStandardMaterial
              color={coveColor}
              emissive={coveColor}
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* coffer beams + luminous laylight panels between them */}
      {bays.centres.map((z, i) => (
        <group key={`bay${i}`}>
          <mesh position={[0, height - 0.13, z - bays.step / 2]}>
            <boxGeometry args={[width, 0.26, 0.3]} />
            <meshStandardMaterial color="#3f3a33" roughness={0.9} />
          </mesh>
          {/* frosted glazing */}
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height - 0.05, z]}>
            <planeGeometry args={[2.7, Math.max(bays.step - 0.8, 0.6)]} />
            <meshStandardMaterial
              color="#fff4e2"
              emissive="#fff1d8"
              emissiveIntensity={0.86}
              toneMapped={false}
            />
          </mesh>
          {/* bronze mullions across the glazing */}
          {[-0.9, 0, 0.9].map((m) => (
            <mesh key={m} position={[m, height - 0.07, z]}>
              <boxGeometry args={[0.05, 0.05, Math.max(bays.step - 0.8, 0.6)]} />
              <meshStandardMaterial color="#2a251f" roughness={0.6} metalness={0.5} />
            </mesh>
          ))}
          {/* the general wash that actually falls on the room */}
          <pointLight
            position={[0, height - 0.5, z]}
            intensity={7}
            distance={13}
            decay={2}
            color="#ffeed6"
          />
        </group>
      ))}

      {/* A soft wash on the end wall. Without it the hero's tight spot reads as
          a lit painting floating in a black void rather than hung on a wall. */}
      <pointLight
        position={[0, 3.1, length - 2.4]}
        intensity={11}
        distance={9}
        decay={2}
        color="#ffeed6"
      />

      {/* ------------------------- lighting track -------------------------- */}
      {([-1, 1] as const).map((s) => (
        <TrackRail key={`tr${s}`} axis="z" fixed={s * (halfW - TRACK_OUT)} from={1} to={length - 0.5} />
      ))}
      <TrackRail axis="x" fixed={length - TRACK_OUT} from={-halfW + 0.6} to={halfW - 0.6} />

      {/* ------------------------------ benches ---------------------------- */}
      {benches.map((b) => (
        <Bench key={b.z} x={b.x} z={b.z} />
      ))}

      {/* Low bounce so nothing ever reads as pure black. Kept deliberately
          small — the paintings' own spots are meant to do the work. */}
      <ambientLight intensity={0.13} color="#a8988a" />
    </group>
  );
}
