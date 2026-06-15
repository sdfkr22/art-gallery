'use client';

import * as THREE from 'three';
import { MeshReflectorMaterial } from '@react-three/drei';

/**
 * The architecture of the hall: a polished stone floor with real-time
 * reflections, warm plaster walls, a coffered ceiling and recessed light
 * strips. Origin is the entrance; the hall runs along +z to `length`.
 */
export default function Room({
  length,
  width = 8,
  height = 4.3,
  accent = '#c9a25a',
}: {
  length: number;
  width?: number;
  height?: number;
  accent?: string;
}) {
  const halfW = width / 2;
  const wallColor = '#e9e2d4';

  // The hall runs from the entrance wall (z = -3) to the end wall (z = length).
  const startZ = -3;
  const depth = length - startZ;
  const midZ = (startZ + length) / 2;

  // Evenly spaced recessed ceiling strips down the hall.
  const strips: number[] = [];
  for (let z = 3; z < length - 1; z += 5) strips.push(z);

  return (
    <group>
      {/* polished floor with reflections */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, midZ]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <MeshReflectorMaterial
          resolution={1024}
          mirror={0.45}
          mixStrength={1.1}
          mixBlur={8}
          blur={[300, 80]}
          roughness={0.85}
          depthScale={0.8}
          minDepthThreshold={0.3}
          maxDepthThreshold={1.2}
          color="#15110d"
          metalness={0.55}
        />
      </mesh>

      {/* ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, midZ]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#0f0d0b" roughness={0.95} />
      </mesh>

      {/* side walls */}
      {([-1, 1] as const).map((s) => (
        <mesh
          key={s}
          position={[s * halfW, height / 2, midZ]}
          rotation={[0, -s * (Math.PI / 2), 0]}
          receiveShadow
        >
          <planeGeometry args={[depth, height]} />
          <meshStandardMaterial color={wallColor} roughness={0.96} />
        </mesh>
      ))}

      {/* end wall (far, where the hero piece hangs) + entrance wall (near) */}
      <mesh position={[0, height / 2, length]} receiveShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={wallColor} roughness={0.96} />
      </mesh>
      <mesh position={[0, height / 2, startZ]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={wallColor} roughness={0.96} />
      </mesh>

      {/* baseboards + crown trim along both side walls */}
      {([-1, 1] as const).map((s) =>
        [0.12, height - 0.12].map((y, i) => (
          <mesh key={`${s}-${i}`} position={[s * (halfW - 0.02), y, midZ]}>
            <boxGeometry args={[0.06, 0.24, depth]} />
            <meshStandardMaterial
              color={i === 0 ? '#1d1812' : '#241d14'}
              roughness={0.6}
              metalness={0.3}
            />
          </mesh>
        )),
      )}

      {/* recessed ceiling light strips (emissive) + soft fill from each */}
      {strips.map((z) => (
        <group key={z} position={[0, height - 0.02, z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1.5, 0.4]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={2.2}
              toneMapped={false}
            />
          </mesh>
          <pointLight
            position={[0, -0.3, 0]}
            intensity={9}
            distance={10}
            decay={2}
            color="#fff1d8"
          />
        </group>
      ))}

      {/* a long runner of subtle ambient bounce near the floor */}
      <ambientLight intensity={0.17} color="#b9a98c" />
    </group>
  );
}
