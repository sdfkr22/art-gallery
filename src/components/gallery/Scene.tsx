'use client';

import { Suspense, useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  Vignette,
  ToneMapping,
  SMAA,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import type { ArtworkDTO } from '@/lib/types';
import Room from './Room';
import Painting, { type PaintingHandle } from './Painting';
import Player from './Player';

const SPACING = 4.2;
const START_Z = 4.5;
const WIDTH = 8;

export interface Placement {
  artwork: ArtworkDTO;
  position: [number, number, number];
  normal: [number, number];
  featured: boolean;
}

/**
 * The most popular work (artworks[0]) hangs large and centred on the end wall —
 * the wall you face on entering, opposite the door. Everything else lines the
 * two side walls, alternating left/right down the hall.
 */
export function layoutArtworks(artworks: ArtworkDTO[]): {
  placements: Placement[];
  length: number;
} {
  const halfW = WIDTH / 2;
  const [hero, ...rest] = artworks;

  const placements: Placement[] = rest.map((artwork, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const slot = Math.floor(i / 2);
    return {
      artwork,
      position: [side * (halfW - 0.08), 1.65, START_Z + slot * SPACING],
      normal: [-side, 0],
      featured: false,
    };
  });

  const sideMaxZ = placements.reduce((m, p) => Math.max(m, p.position[2]), START_Z);
  const endZ = sideMaxZ + 5;

  if (hero) {
    placements.push({
      artwork: hero,
      position: [0, 1.95, endZ - 0.12],
      normal: [0, -1],
      featured: true,
    });
  }

  return { placements, length: endZ };
}

/** Casts a ray from the camera centre to report which painting is being viewed. */
function FocusTracker({
  handles,
  onFocus,
}: {
  handles: React.MutableRefObject<Map<string, PaintingHandle>>;
  onFocus: (a: ArtworkDTO | null) => void;
}) {
  const { camera } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const last = useRef<string | null>(null);
  const dir = useRef(new THREE.Vector3());

  useFrame(() => {
    camera.getWorldDirection(dir.current);
    raycaster.current.set(camera.position, dir.current);
    raycaster.current.far = 7.5;
    const meshes = [...handles.current.values()].map((h) => h.mesh);
    const hit = raycaster.current.intersectObjects(meshes, false)[0];
    const key = (hit?.object.userData.artwork as ArtworkDTO | undefined)?.key ?? null;
    if (key !== last.current) {
      last.current = key;
      onFocus(key ? hit!.object.userData.artwork : null);
    }
  });
  return null;
}

export default function Scene({
  artworks,
  accent,
  onFocus,
  onLockChange,
}: {
  artworks: ArtworkDTO[];
  accent: string;
  onFocus: (a: ArtworkDTO | null) => void;
  onLockChange: (locked: boolean) => void;
}) {
  const { placements, length } = useMemo(() => layoutArtworks(artworks), [artworks]);
  const handles = useRef<Map<string, PaintingHandle>>(new Map());

  const register = useCallback(
    (key: string, h: PaintingHandle | null) => {
      if (h) handles.current.set(key, h);
      else handles.current.delete(key);
    },
    [],
  );

  return (
    <>
      {/* subtle studio environment so gilt frames + floor have something to
          reflect — built from light panels, no external HDRI needed */}
      <Environment resolution={256} frames={1} environmentIntensity={0.35}>
        <Lightformer
          intensity={1.4}
          color="#fff1d8"
          position={[0, 6, length / 2]}
          scale={[10, length, 1]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <Lightformer intensity={0.6} color="#caa" position={[-6, 3, length / 2]} scale={[2, 6, 1]} />
        <Lightformer intensity={0.6} color="#acf" position={[6, 3, length / 2]} scale={[2, 6, 1]} />
      </Environment>

      <fog attach="fog" args={['#0a0807', 8, length + 14]} />

      <Room length={length} width={WIDTH} accent={accent} />

      {placements.map((pl) => (
        <Suspense key={pl.artwork.key} fallback={null}>
          <Painting
            artwork={pl.artwork}
            position={pl.position}
            normal={pl.normal}
            featured={pl.featured}
            register={register}
          />
        </Suspense>
      ))}

      <FocusTracker handles={handles} onFocus={onFocus} />
      <Player length={length} width={WIDTH} onLockChange={onLockChange} />

      <EffectComposer multisampling={0}>
        <SMAA />
        <Bloom
          mipmapBlur
          intensity={0.55}
          luminanceThreshold={0.82}
          luminanceSmoothing={0.16}
        />
        <Vignette eskil={false} offset={0.28} darkness={0.62} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}
