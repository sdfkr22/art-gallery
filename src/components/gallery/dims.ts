/**
 * Shared architecture of the hall. Room, Painting and Player all have to agree
 * on these, and none of them owns the others, so they live here.
 *
 * Origin is the entrance threshold; the hall runs along +z to `length`.
 */

export const ROOM_HEIGHT = 4.3;
export const ROOM_WIDTH = 8;

/** The near wall with the doorway sits behind the visitor. */
export const ENTRANCE_Z = -3;

/** Lighting track rails: this far in from each wall, this high. */
export const TRACK_OUT = 1.85;
export const TRACK_Y = ROOM_HEIGHT - 0.18;

/** Skirting board and picture rail heights. */
export const SKIRTING_H = 0.26;
export const PICTURE_RAIL_Y = 3.05;

export interface Obstacle {
  /** centre */
  x: number;
  z: number;
  /** half-extents on x and z */
  hx: number;
  hz: number;
}

/**
 * Viewing benches down the hall, alternating either side of the centre line.
 * They are solid to walk into, so a row of them straight down the middle would
 * dam the hall; offset, they read as furniture you stroll past.
 */
export function benchLayout(length: number): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  let i = 0;
  for (let z = 7; z < length - 4; z += 8.4, i++) {
    out.push({ x: i % 2 === 0 ? -1.35 : 1.35, z });
  }
  return out;
}

export const BENCH_HALF_X = 0.42;
export const BENCH_HALF_Z = 0.95;

export function benchObstacles(length: number): Obstacle[] {
  return benchLayout(length).map((b) => ({
    x: b.x,
    z: b.z,
    hx: BENCH_HALF_X,
    hz: BENCH_HALF_Z,
  }));
}
