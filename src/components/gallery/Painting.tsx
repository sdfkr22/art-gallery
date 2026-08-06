'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import type { ArtworkDTO } from '@/lib/types';
import { useAutoExposure } from './exposure';
import { canvasWeaveNormal } from './textures';
import { TRACK_OUT, TRACK_Y } from './dims';

export interface PaintingHandle {
  mesh: THREE.Mesh;
  artwork: ArtworkDTO;
}

/**
 * Radiance a pure-white pixel should reach from its own spotlight alone, before
 * tone mapping. The room fill adds roughly another 0.2 on top, which lands a
 * white right at the top of the ACES curve — bright, but still holding detail.
 */
const WHITE_POINT = 0.76;

/* ------------------------------- mouldings -------------------------------- */

/**
 * A rectangular ring of four rails — a real picture frame, not a solid slab
 * behind the canvas. `innerW`/`innerH` is the opening it surrounds.
 */
function Moulding({
  innerW,
  innerH,
  border,
  depth,
  z,
  material,
  castShadow = false,
}: {
  innerW: number;
  innerH: number;
  border: number;
  depth: number;
  z: number;
  material: React.ReactNode;
  castShadow?: boolean;
}) {
  const outerW = innerW + border * 2;
  const hx = innerW / 2 + border / 2;
  const hy = innerH / 2 + border / 2;
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, hy, 0]} castShadow={castShadow}>
        <boxGeometry args={[outerW, border, depth]} />
        {material}
      </mesh>
      <mesh position={[0, -hy, 0]} castShadow={castShadow}>
        <boxGeometry args={[outerW, border, depth]} />
        {material}
      </mesh>
      <mesh position={[-hx, 0, 0]} castShadow={castShadow}>
        <boxGeometry args={[border, innerH, depth]} />
        {material}
      </mesh>
      <mesh position={[hx, 0, 0]} castShadow={castShadow}>
        <boxGeometry args={[border, innerH, depth]} />
        {material}
      </mesh>
    </group>
  );
}

/* -------------------------------- painting -------------------------------- */

/**
 * One hung painting: stretched canvas, carved-and-gilded frame, and the ceiling
 * track spot aimed at it.
 *
 * Everything is built in the frame's own local space — the group is placed at
 * `position` and turned so local +z is `normal`, the direction the picture
 * faces. `featured` is the hero piece on the end wall: bigger, and given its
 * own pair of lights.
 */
export default function Painting({
  artwork,
  position,
  normal,
  featured = false,
  register,
}: {
  artwork: ArtworkDTO;
  position: [number, number, number];
  normal: [number, number];
  featured?: boolean;
  register: (key: string, h: PaintingHandle | null) => void;
}) {
  const texture = useTexture(artwork.thumbUrl);
  const gain = useAutoExposure(texture, artwork.key);
  const weave = useMemo(() => canvasWeaveNormal(), []);

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 16;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
  }, [texture]);

  // Canvas size from the work's real aspect ratio, capped to what fits a wall.
  const { w, h } = useMemo(() => {
    const aspect = (artwork.widthPx || 1000) / (artwork.heightPx || 1000);
    const baseH = featured ? 2.2 : 1.62;
    const MAX_W = featured ? 3.5 : 2.6;
    const MAX_H = featured ? 2.6 : 2.0;
    let hh = baseH;
    let ww = hh * aspect;
    if (ww > MAX_W) {
      ww = MAX_W;
      hh = ww / aspect;
    }
    if (hh > MAX_H) {
      hh = MAX_H;
      ww = hh * aspect;
    }
    return { w: ww, h: hh };
  }, [artwork, featured]);

  const [x, y, z] = position;
  const rotationY = Math.atan2(normal[0], normal[1]);

  // Weave tiles at a fixed real-world density rather than per-canvas, so a big
  // painting shows a bigger weave count like the real thing.
  const weaveMap = useMemo(() => {
    const t = weave.clone();
    t.repeat.set(w * 2.2, h * 2.2);
    t.needsUpdate = true;
    return t;
  }, [weave, w, h]);
  useEffect(() => () => weaveMap.dispose(), [weaveMap]);

  const meshRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Object3D>(null);

  useEffect(() => {
    if (lightRef.current && targetRef.current) {
      lightRef.current.target = targetRef.current;
      lightRef.current.target.updateMatrixWorld();
    }
  }, []);

  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.userData.artwork = artwork;
      register(artwork.key, { mesh: meshRef.current, artwork });
    }
    return () => register(artwork.key, null);
  }, [artwork, register]);

  /**
   * Aim and dim the spot. Intensity is solved from the actual geometry so that
   * a white pixel lands on WHITE_POINT regardless of how big the painting is or
   * how high it hangs — then scaled by the auto-exposure gain for this image.
   *
   * decay is 1, not the physical 2: over a 2 m canvas an inverse-square falloff
   * from a fixture this close makes the top four times brighter than the
   * bottom, which is exactly the "top is blown out, bottom is mud" look. Real
   * gallery fixtures fight the same problem with spread lenses; this is the
   * cheap equivalent.
   */
  const spot = useMemo(() => {
    const up = TRACK_Y - y;
    const dist = Math.hypot(up, TRACK_OUT);
    const factor = (TRACK_OUT / dist) / dist; // cos(incidence) / d, for decay = 1
    const radius = Math.hypot(w / 2, h / 2);
    return {
      up,
      dist,
      intensity: ((WHITE_POINT * Math.PI) / factor) * gain,
      angle: Math.min(Math.atan(radius / dist) + 0.16, 0.7),
    };
  }, [y, w, h, gain]);

  const border = featured ? 0.13 : 0.095;
  const CANVAS_Z = 0.022;
  const LIP = 0.03;

  return (
    <group position={[x, y, z]} rotation={[0, rotationY, 0]}>
      {/* Stretcher: the canvas is wrapped over a wooden strainer, not glued flat.
          Its front face stops short of the canvas plane — coplanar surfaces
          z-fight, and at some distances the dark wood wins and the painting
          reads as an empty black frame. */}
      <mesh position={[0, 0, (CANVAS_Z - 0.006) / 2]}>
        <boxGeometry args={[w - 0.02, h - 0.02, CANVAS_Z - 0.006]} />
        <meshStandardMaterial color="#2a2018" roughness={0.9} />
      </mesh>

      {/* the painting */}
      <mesh ref={meshRef} position={[0, 0, CANVAS_Z]} receiveShadow>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          map={texture}
          normalMap={weaveMap}
          normalScale={new THREE.Vector2(0.16, 0.16)}
          roughness={0.78}
          metalness={0}
          envMapIntensity={0.25}
        />
      </mesh>

      {/* bright gilt lip, overlapping the canvas edge the way a real rebate does */}
      <Moulding
        innerW={w - 0.018}
        innerH={h - 0.018}
        border={LIP}
        depth={0.05}
        z={CANVAS_Z + 0.024}
        material={
          <meshStandardMaterial color="#b08c3e" roughness={0.34} metalness={0.9} />
        }
      />

      {/* outer carved moulding */}
      <Moulding
        innerW={w - 0.018 + LIP * 2}
        innerH={h - 0.018 + LIP * 2}
        border={border}
        depth={0.075}
        z={0.038}
        castShadow
        material={
          <meshStandardMaterial color="#3a2a17" roughness={0.52} metalness={0.35} />
        }
      />
      {/* the outer bead that catches the light along the very edge */}
      <Moulding
        innerW={w - 0.018 + LIP * 2 + border * 2 - 0.02}
        innerH={h - 0.018 + LIP * 2 + border * 2 - 0.02}
        border={0.018}
        depth={0.052}
        z={0.026}
        material={
          <meshStandardMaterial color="#8a6c30" roughness={0.4} metalness={0.85} />
        }
      />

      {/* ceiling track spot: the fixture you can actually see overhead…
          rotated so its barrel points down the beam at the canvas. */}
      <group
        position={[0, spot.up, TRACK_OUT]}
        rotation={[Math.atan2(-TRACK_OUT, -spot.up), 0, 0]}
      >
        {/* no castShadow: the housing sits exactly on the light and would
            shadow the very beam it emits */}
        <mesh>
          <cylinderGeometry args={[0.055, 0.07, 0.2, 16]} />
          <meshStandardMaterial color="#17161a" roughness={0.45} metalness={0.7} />
        </mesh>
        <mesh position={[0, -0.101, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.052, 16]} />
          <meshBasicMaterial color="#fff0d2" toneMapped={false} />
        </mesh>
      </group>

      {/* …and the light it throws */}
      <spotLight
        ref={lightRef}
        position={[0, spot.up, TRACK_OUT]}
        angle={spot.angle}
        penumbra={0.62}
        decay={1}
        distance={spot.dist * 3.2}
        intensity={spot.intensity}
        color="#fff2dd"
        castShadow
        shadow-mapSize={[512, 512]}
        shadow-bias={-0.0007}
        shadow-normalBias={0.025}
      />
      <object3D ref={targetRef} />
    </group>
  );
}
