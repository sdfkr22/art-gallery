'use client';

import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import {
  EffectComposer,
  Bloom,
  Noise,
  Vignette,
  ToneMapping,
  SMAA,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import type { ArtworkDTO } from '@/lib/types';
import Room from './Room';
import Painting, { type PaintingHandle } from './Painting';
import Player from './Player';
import { ROOM_WIDTH, ROOM_HEIGHT, ENTRANCE_Z, benchObstacles } from './dims';

const SPACING = 4.2;
const START_Z = 4.5;
const WIDTH = ROOM_WIDTH;
/** Museum hanging height: centre of the picture at roughly standing eye level. */
const HANG_Y = 1.62;
const HERO_HANG_Y = 1.85;

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
 *
 * Positions sit exactly on the wall plane; each frame is built facing `normal`
 * and protrudes into the room from there.
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
      position: [side * halfW, HANG_Y, START_Z + slot * SPACING],
      normal: [-side, 0],
      featured: false,
    };
  });

  const sideMaxZ = placements.reduce((m, p) => Math.max(m, p.position[2]), START_Z);
  const endZ = sideMaxZ + 5;

  if (hero) {
    placements.push({
      artwork: hero,
      position: [0, HERO_HANG_Y, endZ],
      normal: [0, -1],
      featured: true,
    });
  }

  return { placements, length: endZ };
}

/* --------------------------- resilience + perf ---------------------------- */

const MAX_TEXTURE_RETRIES = 3;

/**
 * A painting whose image fails to load would otherwise throw out of Suspense
 * and take the whole canvas down with it.
 *
 * Most of these failures are transient — twelve full-size Commons images
 * requested at once will sometimes earn a 429 — so we clear the loader cache
 * and remount the painting a few times with a widening delay before giving up.
 * Only a genuinely dead URL ends as a blank patch of wall, and never as a dead
 * gallery.
 */
class PaintingBoundary extends Component<
  { url: string; children: ReactNode },
  { failed: boolean; attempt: number }
> {
  private timer: ReturnType<typeof setTimeout> | undefined;
  state = { failed: false, attempt: 0 };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    if (this.state.attempt >= MAX_TEXTURE_RETRIES) return;
    this.timer = setTimeout(
      () => {
        useLoader.clear(THREE.TextureLoader, this.props.url);
        this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }));
      },
      1200 * 2 ** this.state.attempt,
    );
  }

  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
  }

  render() {
    if (this.state.failed) return null;
    // Remounting under a fresh key is what makes the retry actually re-fetch.
    return <group key={this.state.attempt}>{this.props.children}</group>;
  }
}

/**
 * Nothing in the hall moves, so its dozen shadow maps only need rendering when
 * a painting appears — not sixty times a second. We keep re-rendering for a
 * couple of seconds after each arrival to cover textures still decoding.
 */
function StaticShadows({ revision }: { revision: number }) {
  const { gl } = useThree();
  const settleUntil = useRef(0);

  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);

  useEffect(() => {
    settleUntil.current = performance.now() + 2500;
  }, [revision]);

  useFrame(() => {
    if (performance.now() < settleUntil.current) gl.shadowMap.needsUpdate = true;
  });
  return null;
}

/** Motes drifting in the beams. Almost subliminal, and the air stops feeling empty. */
function Dust({ length }: { length: number }) {
  const COUNT = 360;
  const ref = useRef<THREE.Points>(null);

  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * (WIDTH - 0.6);
      positions[i * 3 + 1] = Math.random() * (ROOM_HEIGHT - 0.5);
      positions[i * 3 + 2] = ENTRANCE_Z + Math.random() * (length - ENTRANCE_Z);
      speeds[i] = 0.012 + Math.random() * 0.03;
    }
    return { positions, speeds };
  }, [length]);

  useFrame((state, delta) => {
    const geo = ref.current?.geometry;
    if (!geo) return;
    const arr = geo.attributes.position.array as Float32Array;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] += speeds[i] * delta;
      arr[i * 3] += Math.sin(t * 0.3 + i) * 0.0012;
      if (arr[i * 3 + 1] > ROOM_HEIGHT - 0.3) arr[i * 3 + 1] = 0.15;
    }
    geo.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.014}
        sizeAttenuation
        color="#ffeccc"
        transparent
        opacity={0.32}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
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

/* ---------------------------------- scene --------------------------------- */

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
  const [hung, setHung] = useState(0);

  const register = useCallback((key: string, h: PaintingHandle | null) => {
    if (h) handles.current.set(key, h);
    else handles.current.delete(key);
    setHung((n) => n + 1);
  }, []);

  const obstacles = useMemo(() => benchObstacles(length), [length]);

  return (
    <>
      {/* A soft studio environment so gilt frames, stone and brass have
          something to reflect — built from light panels, no external HDRI. */}
      <Environment resolution={256} frames={1} environmentIntensity={0.28}>
        <Lightformer
          intensity={1.2}
          color="#fff1d8"
          position={[0, 6, length / 2]}
          scale={[10, length, 1]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <Lightformer intensity={0.5} color="#d8c3a4" position={[-6, 3, length / 2]} scale={[2, 6, 1]} />
        <Lightformer intensity={0.5} color="#b9c6d8" position={[6, 3, length / 2]} scale={[2, 6, 1]} />
      </Environment>

      {/* barely-there haze: enough to give the far end of the hall some air */}
      <fog attach="fog" args={['#1a1613', 12, length + 26]} />

      <Room length={length} width={WIDTH} accent={accent} />
      <Dust length={length} />

      {placements.map((pl) => (
        <PaintingBoundary key={pl.artwork.key} url={pl.artwork.thumbUrl}>
          <Suspense fallback={null}>
            <Painting
              artwork={pl.artwork}
              position={pl.position}
              normal={pl.normal}
              featured={pl.featured}
              register={register}
            />
          </Suspense>
        </PaintingBoundary>
      ))}

      <StaticShadows revision={hung} />
      <FocusTracker handles={handles} onFocus={onFocus} />
      <Player
        length={length}
        width={WIDTH}
        obstacles={obstacles}
        onLockChange={onLockChange}
      />

      <EffectComposer multisampling={0}>
        <SMAA />
        {/* Threshold sits above 1.0 on purpose: paintings are lit to peak right
            around white, and blooming them is precisely what turns a pale
            canvas into an unreadable glowing rectangle. Only the laylights and
            the lamp lenses, which are emissive past 1, are allowed to flare. */}
        <Bloom
          mipmapBlur
          intensity={0.38}
          luminanceThreshold={1.02}
          luminanceSmoothing={0.22}
        />
        <Vignette eskil={false} offset={0.32} darkness={0.5} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Noise premultiply opacity={0.03} />
      </EffectComposer>
    </>
  );
}
