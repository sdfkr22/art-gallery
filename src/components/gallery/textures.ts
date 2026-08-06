'use client';

import * as THREE from 'three';

/**
 * Procedurally generated surface maps. Nothing here is loaded over the network —
 * the whole museum ships as code — but flat untextured planes are the single
 * biggest giveaway that a room is fake, so every large surface gets grain.
 *
 * Each generator is memoised behind a module-level cache: the maps are shared
 * by every room and survive gallery switches.
 */

/* ------------------------------ noise helpers ---------------------------- */

function hash2(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Classic value noise, tileable over `period` cells. */
function valueNoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const w = (i: number, j: number) =>
    hash2(((i % period) + period) % period, ((j % period) + period) % period, seed);
  const a = w(xi, yi);
  const b = w(xi + 1, yi);
  const c = w(xi, yi + 1);
  const d = w(xi + 1, yi + 1);
  return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
}

/** Summed octaves, returns 0..1. */
function fbm(x: number, y: number, cells: number, seed: number, octaves = 4): number {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    v += amp * valueNoise(x * cells * freq, y * cells * freq, cells * freq, seed + o * 13);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return v / norm;
}

function newCanvas(size: number) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d')! };
}

function toTexture(canvas: HTMLCanvasElement, repeat: number, srgb: boolean) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Height field -> tangent-space normal map, via central differences. */
function heightToNormal(height: Float32Array, size: number, strength: number) {
  const { canvas, ctx } = newCanvas(size);
  const img = ctx.createImageData(size, size);
  const at = (x: number, y: number) =>
    height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 0.5 * 255 + 127.5;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/* -------------------------------- surfaces -------------------------------- */

export interface SurfaceMaps {
  map?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
}

let stoneCache: SurfaceMaps | null = null;

/**
 * Large sawn-limestone slabs with a warm grey cast, thin dark joints and soft
 * mineral clouding — the floor of basically every civic gallery built before
 * 1960. Reflections come from MeshReflectorMaterial on top of these.
 */
export function stoneFloorMaps(): SurfaceMaps {
  if (stoneCache) return stoneCache;
  const S = 512;
  const { canvas, ctx } = newCanvas(S);
  const rough = newCanvas(S);
  const height = new Float32Array(S * S);

  const img = ctx.createImageData(S, S);
  const rimg = rough.ctx.createImageData(S, S);
  // 2x2 slabs per tile, offset every other row like real slab courses.
  const SLAB = S / 2;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const row = Math.floor(y / SLAB);
      const shift = row % 2 === 1 ? SLAB / 2 : 0;
      const sx = (x + shift) % S;
      const col = Math.floor(sx / SLAB);
      const seed = row * 31 + col * 7;

      // distance to the nearest joint, in px
      const jx = Math.min(sx % SLAB, SLAB - (sx % SLAB));
      const jy = Math.min(y % SLAB, SLAB - (y % SLAB));
      const joint = Math.min(jx, jy);

      // per-slab tone variation + fine mineral clouding
      const slabTone = 0.94 + hash2(col, row, 5) * 0.12;
      const cloud = fbm(x / S, y / S, 6, 1) * 0.5 + fbm(x / S, y / S, 24, 2 + seed) * 0.5;
      let v = 118 * slabTone * (0.86 + cloud * 0.28);

      // faint diagonal veining
      const vein = fbm((x + y * 0.4) / S, y / S, 10, 9);
      if (vein > 0.62) v *= 0.9 + (vein - 0.62) * 0.4;

      let r = 200 - cloud * 60;
      if (joint < 2) {
        const k = joint / 2;
        v *= 0.34 + k * 0.4;
        r = 245;
        height[y * S + x] = -1 + k;
      } else {
        height[y * S + x] = cloud * 0.25;
      }

      const i = (y * S + x) * 4;
      img.data[i] = v * 1.035;
      img.data[i + 1] = v;
      img.data[i + 2] = v * 0.955;
      img.data[i + 3] = 255;
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = r;
      rimg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rough.ctx.putImageData(rimg, 0, 0);

  stoneCache = {
    map: toTexture(canvas, 4, true),
    roughnessMap: toTexture(rough.canvas, 4, false),
    normalMap: toTexture(heightToNormal(height, S, 2.2), 4, false),
  };
  return stoneCache;
}

let plasterCache: SurfaceMaps | null = null;

/** Hand-floated plaster: near-invisible up close, kills the "flat plane" look. */
export function plasterMaps(): SurfaceMaps {
  if (plasterCache) return plasterCache;
  const S = 256;
  const height = new Float32Array(S * S);
  const rough = newCanvas(S);
  const rimg = rough.ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = fbm(x / S, y / S, 8, 21, 5);
      const fine = hash2(x, y, 3);
      height[y * S + x] = n * 0.7 + fine * 0.3;
      const i = (y * S + x) * 4;
      const r = 232 + n * 22;
      rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = r;
      rimg.data[i + 3] = 255;
    }
  }
  rough.ctx.putImageData(rimg, 0, 0);
  plasterCache = {
    roughnessMap: toTexture(rough.canvas, 6, false),
    normalMap: toTexture(heightToNormal(height, S, 0.55), 6, false),
  };
  return plasterCache;
}

let rectShadowCache: THREE.Texture | null = null;

/**
 * Soft-edged rectangular alpha, used as the painted drop shadow a frame casts
 * on the wall. See `softShadowTexture` for why the shadows are painted.
 */
export function softRectShadow(): THREE.Texture {
  if (rectShadowCache) return rectShadowCache;
  const S = 128;
  const { canvas, ctx } = newCanvas(S);
  ctx.filter = 'blur(11px)';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(20, 20, S - 40, S - 40);
  ctx.filter = 'none';
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  rectShadowCache = tex;
  return tex;
}

let blobCache: THREE.Texture | null = null;

/**
 * Soft round alpha blob used as a painted contact shadow.
 *
 * The hall casts no real-time shadows at all. A shadow-mapped spot per painting
 * meant a dozen extra samplers bound into every material in the scene, and the
 * heaviest of them — the reflective floor — could run out of texture units and
 * render black on some drivers. Nothing in the room moves, so painted shadows
 * cost one quad and cannot break.
 */
export function softShadowTexture(): THREE.Texture {
  if (blobCache) return blobCache;
  const S = 128;
  const { canvas, ctx } = newCanvas(S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.6)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.3)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  blobCache = tex;
  return tex;
}

let oakCache: SurfaceMaps | null = null;

/** Dark stained oak for skirtings, benches and frames. */
export function oakMaps(): SurfaceMaps {
  if (oakCache) return oakCache;
  const S = 256;
  const { canvas, ctx } = newCanvas(S);
  const img = ctx.createImageData(S, S);
  const height = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // grain runs along x; rings come from a stretched noise field
      const ring = fbm(x / S, (y / S) * 9, 7, 33, 4);
      const line = Math.abs(Math.sin(ring * Math.PI * 7));
      const g = 0.55 + line * 0.45;
      height[y * S + x] = line * 0.4;
      const i = (y * S + x) * 4;
      img.data[i] = 142 * g;
      img.data[i + 1] = 104 * g;
      img.data[i + 2] = 68 * g;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  oakCache = {
    map: toTexture(canvas, 3, true),
    normalMap: toTexture(heightToNormal(height, S, 0.7), 3, false),
  };
  return oakCache;
}
