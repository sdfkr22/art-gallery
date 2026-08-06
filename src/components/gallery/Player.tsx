'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import type { PointerLockControls as PLC } from 'three-stdlib';
import type { Obstacle } from './dims';

const EYE = 1.66;
const WALK = 1.55; // m/s — museum pace, not a shooter sprint
const STRIDE = 2.1; // holding shift
/** How fast the body reaches target speed, and how fast it coasts to a stop. */
const ACCEL = 9;
const DAMPING = 11;
/** Stride length; the bob completes one full cycle per two steps. */
const STEP_LENGTH = 0.78;
const BOB_Y = 0.032;
const BOB_X = 0.019;
/** Personal space kept off walls and furniture. */
const BODY_R = 0.42;

/**
 * First-person navigation. Click to capture the mouse for look, WASD / arrows
 * to walk, shift to stride.
 *
 * Movement is run through a small velocity model rather than teleporting the
 * camera by `speed * delta`: you lean into a walk and coast to a halt, and the
 * head rises and falls on each step. Instant, perfectly level gliding is the
 * fastest way to make a room feel like a 3D model instead of a place.
 */
export default function Player({
  length,
  width,
  obstacles = [],
  onLockChange,
}: {
  length: number;
  width: number;
  obstacles?: Obstacle[];
  onLockChange?: (locked: boolean) => void;
}) {
  const { camera } = useThree();
  const controls = useRef<PLC>(null);
  const keys = useRef<Record<string, boolean>>({});

  const halfW = width / 2 - BODY_R - 0.25;

  /** Body position at floor level — the camera rides on top of this. */
  const body = useRef(new THREE.Vector3(0, 0, 1.2));
  const velocity = useRef(new THREE.Vector3());
  const bobPhase = useRef(0);

  const scratch = useMemo(
    () => ({
      dir: new THREE.Vector3(),
      right: new THREE.Vector3(),
      wish: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );

  useEffect(() => {
    body.current.set(0, 0, 1.2);
    velocity.current.set(0, 0, 0);
    camera.position.set(0, EYE, 1.2);
    camera.lookAt(0, EYE, 8);
  }, [camera]);

  // Guard drei's lock() so it never calls requestPointerLock on a canvas that
  // has been detached (e.g. when the Canvas unmounts on "Leave gallery" / artist
  // switch, or during dev HMR). Otherwise the browser throws
  // "Failed to execute 'requestPointerLock': Target Element removed from DOM".
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const original = c.lock.bind(c);
    c.lock = () => {
      const el = c.domElement as Element | undefined;
      if (el && el.isConnected) original();
    };
    return () => {
      c.lock = original;
    };
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => (keys.current[e.code] = true);
    const up = (e: KeyboardEvent) => (keys.current[e.code] = false);
    const blur = () => (keys.current = {});
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05); // don't lurch after a stall
    const k = keys.current;
    const { dir, right, wish, up } = scratch;

    const f = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
    const s = (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0);

    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    right.crossVectors(dir, up).normalize();

    wish.set(0, 0, 0).addScaledVector(dir, f).addScaledVector(right, s);
    const target = k['ShiftLeft'] || k['ShiftRight'] ? STRIDE : WALK;
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(target);

    // ease toward the wished-for velocity, then bleed off what's left
    const v = velocity.current;
    v.lerp(wish, 1 - Math.exp(-ACCEL * delta));
    if (wish.lengthSq() === 0) v.multiplyScalar(Math.exp(-DAMPING * delta));

    const p = body.current;
    p.addScaledVector(v, delta);

    // walls: stop short of the pictures rather than pressing your nose to them
    p.x = THREE.MathUtils.clamp(p.x, -halfW, halfW);
    p.z = THREE.MathUtils.clamp(p.z, 0.7, length - 1.5);

    // furniture: push out along whichever axis you are least embedded in
    for (const o of obstacles) {
      const dx = p.x - o.x;
      const dz = p.z - o.z;
      const ox = o.hx + BODY_R - Math.abs(dx);
      const oz = o.hz + BODY_R - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) {
          p.x = o.x + Math.sign(dx || 1) * (o.hx + BODY_R);
          v.x = 0;
        } else {
          p.z = o.z + Math.sign(dz || 1) * (o.hz + BODY_R);
          v.z = 0;
        }
      }
    }

    // head bob, driven by distance covered so it stays in step at any speed
    const speed = Math.hypot(v.x, v.z);
    bobPhase.current += (speed * delta * Math.PI) / STEP_LENGTH;
    const swing = Math.min(speed / WALK, 1.2);
    const bobY = Math.sin(bobPhase.current * 2) * BOB_Y * swing;
    const bobX = Math.sin(bobPhase.current) * BOB_X * swing;

    camera.position.set(p.x + right.x * bobX, EYE + bobY, p.z + right.z * bobX);
  });

  return (
    <PointerLockControls
      ref={controls}
      selector="canvas"
      onLock={() => onLockChange?.(true)}
      onUnlock={() => onLockChange?.(false)}
    />
  );
}
