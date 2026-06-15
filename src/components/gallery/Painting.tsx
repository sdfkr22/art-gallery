'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import type { ArtworkDTO } from '@/lib/types';

export interface PaintingHandle {
  mesh: THREE.Mesh;
  artwork: ArtworkDTO;
}

/**
 * A single framed canvas, lit by its own warm museum spotlight.
 * `position` is the centre on the wall; `normal` is the [x, z] direction the
 * painting faces (into the room). `featured` hangs it larger + brighter as the
 * hero piece on the end wall.
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

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);

  // Canvas dimensions from native aspect, capped to sane wall sizes (metres).
  const { w, h } = useMemo(() => {
    const aspect = (artwork.widthPx || 1000) / (artwork.heightPx || 1000);
    const baseH = featured ? 2.3 : 1.7;
    const MAX_W = featured ? 3.6 : 2.8;
    const MAX_H = featured ? 2.7 : 2.1;
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
  const n = useMemo(
    () => new THREE.Vector3(normal[0], 0, normal[1]).normalize(),
    [normal],
  );
  const rotationY = Math.atan2(n.x, n.z);

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

  const frameBorder = featured ? 0.16 : 0.11;
  const frameDepth = 0.09;
  // The canvas must sit in front of every frame element (the gilt lip box is
  // ~0.048 proud of the wall) or it gets occluded.
  const proud = 0.075;
  const cx = x + n.x * proud;
  const cz = z + n.z * proud;
  const lx = x + n.x * 1.3;
  const lz = z + n.z * 1.3;

  return (
    <group>
      {/* dark wood frame */}
      <mesh position={[x, y, z]} rotation={[0, rotationY, 0]} castShadow receiveShadow>
        <boxGeometry args={[w + frameBorder * 2, h + frameBorder * 2, frameDepth]} />
        <meshStandardMaterial color="#1c150c" roughness={0.45} metalness={0.55} />
      </mesh>
      {/* inner gilt lip */}
      <mesh position={[x, y, z]} rotation={[0, rotationY, 0]}>
        <boxGeometry args={[w + frameBorder, h + frameBorder, frameDepth + 0.005]} />
        <meshStandardMaterial color="#7a5a25" roughness={0.35} metalness={0.85} />
      </mesh>

      {/* the painting itself — faint self-emission keeps the art legible */}
      <mesh ref={meshRef} position={[cx, y, cz]} rotation={[0, rotationY, 0]}>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.66}
          metalness={0}
          emissive="#ffffff"
          emissiveMap={texture}
          emissiveIntensity={0.22}
        />
      </mesh>

      {/* brass picture-light fixture above the frame */}
      <mesh
        position={[x + n.x * 0.18, y + h / 2 + frameBorder + 0.12, z + n.z * 0.18]}
        rotation={[0, rotationY, 0]}
        castShadow
      >
        <boxGeometry args={[Math.min(w, featured ? 1.6 : 1.1), 0.05, 0.16]} />
        <meshStandardMaterial color="#caa24f" roughness={0.3} metalness={0.9} />
      </mesh>

      {/* warm spotlight washing the canvas */}
      <spotLight
        ref={lightRef}
        position={[lx, y + 1.85, lz]}
        angle={featured ? 0.66 : 0.72}
        penumbra={0.55}
        distance={featured ? 13 : 11}
        intensity={featured ? 95 : 62}
        color="#ffe9c8"
        castShadow
        shadow-mapSize={[512, 512]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.02}
      />
      <object3D ref={targetRef} position={[x, y, z]} />
    </group>
  );
}
