'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import type { PointerLockControls as PLC } from 'three-stdlib';

const EYE = 1.62;
const SPEED = 3.1;
const SPRINT = 1.8;

/**
 * First-person navigation: click to capture the mouse for look, WASD / arrows
 * to walk, Shift to stride. The camera is clamped inside the hall.
 */
export default function Player({
  length,
  width,
  onLockChange,
}: {
  length: number;
  width: number;
  onLockChange?: (locked: boolean) => void;
}) {
  const { camera } = useThree();
  const controls = useRef<PLC>(null);
  const keys = useRef<Record<string, boolean>>({});

  const halfW = width / 2 - 0.55;

  useEffect(() => {
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
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const dir = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  useFrame((_, delta) => {
    const k = keys.current;
    const f = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
    const s = (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0);
    if (f === 0 && s === 0) return;

    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    right.crossVectors(dir, up).normalize();

    const speed = SPEED * (k['ShiftLeft'] || k['ShiftRight'] ? SPRINT : 1) * delta;
    camera.position.addScaledVector(dir, f * speed);
    camera.position.addScaledVector(right, s * speed);

    // keep the visitor inside the hall (stopping just short of the hero wall)
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -halfW, halfW);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, 0.6, length - 1.4);
    camera.position.y = EYE;
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
