'use client';

import { useEffect, useState } from 'react';
import * as THREE from 'three';

/**
 * Per-painting auto-exposure.
 *
 * Every canvas on the wall is a photograph of a different painting shot under
 * different conditions: a Turner sky is nearly white, a Rembrandt is nearly
 * black. Lighting them all with the same fixture blows the pale ones out to
 * flat white (you literally cannot see the picture) and buries the dark ones.
 *
 * So we read the texture once, measure how bright it actually is, and return a
 * multiplier for that painting's spotlight. Bright works get dimmer light, dark
 * works get more — the same thing a lighting designer does with a dimmer on
 * each picture light.
 *
 * Two constraints are balanced:
 *   - mid-tone: push the *average* linear luminance toward MID_TARGET so every
 *     canvas reads with similar overall weight;
 *   - highlight: never let the brightest ~8% of the image exceed HIGHLIGHT_CEIL
 *     once lit, which is what stops whites from clipping into a flat blob.
 * The tighter of the two wins.
 */

/** Where we want a painting's mean luminance to sit (linear, pre-tone-map). */
const MID_TARGET = 0.115;
/** Ceiling for the 92nd-percentile luminance, so highlights keep their detail. */
const HIGHLIGHT_CEIL = 0.95;
/** Everything that is not this painting's own spotlight (room fill, bounce). */
const AMBIENT_SHARE = 0.22;

const MIN_GAIN = 0.4;
const MAX_GAIN = 2.1;

/** Analysis is keyed by artwork, so switching rooms and back is instant. */
const cache = new Map<string, number>();

/** 8-bit sRGB channel -> linear. */
const LUT = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  LUT[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Downsample to 32x32 and measure. Returns null if the pixels are unreadable. */
function measure(image: CanvasImageSource): { mean: number; high: number } | null {
  const N = 32;
  const canvas = document.createElement('canvas');
  canvas.width = N;
  canvas.height = N;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  try {
    ctx.drawImage(image, 0, 0, N, N);
    const { data } = ctx.getImageData(0, 0, N, N);
    const lum = new Float32Array(N * N);
    let sum = 0;
    for (let i = 0, p = 0; p < lum.length; i += 4, p++) {
      const l = 0.2126 * LUT[data[i]] + 0.7152 * LUT[data[i + 1]] + 0.0722 * LUT[data[i + 2]];
      lum[p] = l;
      sum += l;
    }
    lum.sort();
    return { mean: sum / lum.length, high: lum[Math.floor(lum.length * 0.92)] };
  } catch {
    // Tainted canvas (a texture served without CORS headers) — fall back to 1.
    return null;
  }
}

export function computeGain(mean: number, high: number): number {
  const byMid = MID_TARGET / Math.max(mean, 0.004);
  const byHighlight = HIGHLIGHT_CEIL / Math.max(high * (1 + AMBIENT_SHARE), 0.02);
  return THREE.MathUtils.clamp(Math.min(byMid, byHighlight), MIN_GAIN, MAX_GAIN);
}

/**
 * Returns the light multiplier for this texture. Starts at 1 and settles to the
 * measured value on the frame after the image decodes.
 */
export function useAutoExposure(texture: THREE.Texture, key: string): number {
  const [gain, setGain] = useState(() => cache.get(key) ?? 1);

  useEffect(() => {
    const cached = cache.get(key);
    if (cached !== undefined) {
      setGain(cached);
      return;
    }
    const image = texture.image as CanvasImageSource | undefined;
    if (!image || typeof document === 'undefined') return;

    const stats = measure(image);
    const g = stats ? computeGain(stats.mean, stats.high) : 1;
    cache.set(key, g);
    setGain(g);
  }, [texture, key]);

  return gain;
}
