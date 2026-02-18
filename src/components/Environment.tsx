import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { TRACK_POINTS } from './Track';

// Tree component
function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <RigidBody type="fixed" position={position} colliders={false}>
      {/* Trunk */}
      <mesh castShadow position={[0, 1.5 * scale, 0]}>
        <cylinderGeometry args={[0.3 * scale, 0.4 * scale, 3 * scale, 8]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <CuboidCollider args={[0.3 * scale, 1.5 * scale, 0.3 * scale]} position={[0, 1.5 * scale, 0]} />

      {/* Leaves - bottom layer */}
      <mesh castShadow position={[0, 3.5 * scale, 0]}>
        <coneGeometry args={[2 * scale, 2.5 * scale, 8]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>

      {/* Leaves - middle layer */}
      <mesh castShadow position={[0, 4.8 * scale, 0]}>
        <coneGeometry args={[1.5 * scale, 2 * scale, 8]} />
        <meshStandardMaterial color="#32CD32" />
      </mesh>

      {/* Leaves - top layer */}
      <mesh castShadow position={[0, 5.8 * scale, 0]}>
        <coneGeometry args={[0.8 * scale, 1.5 * scale, 8]} />
        <meshStandardMaterial color="#90EE90" />
      </mesh>
    </RigidBody>
  );
}

// Rock component
function Rock({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <RigidBody type="fixed" position={position} colliders={false}>
      <mesh castShadow>
        <dodecahedronGeometry args={[scale, 0]} />
        <meshStandardMaterial color="#808080" roughness={0.9} />
      </mesh>
      <CuboidCollider args={[scale * 0.8, scale * 0.6, scale * 0.8]} />
    </RigidBody>
  );
}

// Cloud component
function Cloud({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  const cloudRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (cloudRef.current) {
      cloudRef.current.position.x += Math.sin(clock.getElapsedTime() * 0.1 + position[0]) * 0.01;
    }
  });

  return (
    <group ref={cloudRef} position={position}>
      <mesh>
        <sphereGeometry args={[2 * scale, 16, 16]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.8} />
      </mesh>
      <mesh position={[1.5 * scale, 0.3 * scale, 0]}>
        <sphereGeometry args={[1.5 * scale, 16, 16]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.8} />
      </mesh>
      <mesh position={[-1.5 * scale, 0.2 * scale, 0]}>
        <sphereGeometry args={[1.3 * scale, 16, 16]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0, 0.8 * scale, 0.5 * scale]}>
        <sphereGeometry args={[1.2 * scale, 16, 16]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

// Item Box component
function ItemBox({ position }: { position: [number, number, number] }) {
  const boxRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (boxRef.current) {
      boxRef.current.rotation.y = clock.getElapsedTime() * 2;
      boxRef.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 3) * 0.3;
    }
  });

  return (
    <RigidBody type="fixed" position={position} sensor>
      <mesh ref={boxRef} castShadow>
        <boxGeometry args={[1.5, 1.5, 1.5]} />
        <meshStandardMaterial
          color="#ffdd00"
          emissive="#ffaa00"
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* Question mark */}
      <mesh position={[0, 0, 0.76]}>
        <planeGeometry args={[0.8, 0.8]} />
        <meshBasicMaterial color="#000000">
          <canvasTexture
            attach="map"
            image={(() => {
              const canvas = document.createElement('canvas');
              canvas.width = 64;
              canvas.height = 64;
              const ctx = canvas.getContext('2d')!;
              ctx.fillStyle = '#ffdd00';
              ctx.fillRect(0, 0, 64, 64);
              ctx.fillStyle = '#000000';
              ctx.font = 'bold 45px Arial';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('?', 32, 32);
              return canvas;
            })()}
          />
        </meshBasicMaterial>
      </mesh>
    </RigidBody>
  );
}

// Main Environment component
export function Environment() {
  // Generate tree positions — two rings: near-track and far-field
  const trees = useMemo(() => {
    const positions: { position: [number, number, number]; scale: number }[] = [];

    // Near-track trees (just outside the barriers)
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2 + Math.random() * 0.4;
      const radius = 100 + Math.random() * 40;
      positions.push({
        position: [
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius,
        ],
        scale: 0.8 + Math.random() * 0.6,
      });
    }

    // Far-field trees filling the larger world
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2 + Math.random() * 0.6;
      const radius = 160 + Math.random() * 200;
      positions.push({
        position: [
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius,
        ],
        scale: 1 + Math.random() * 1.0,
      });
    }

    return positions;
  }, []);

  // Generate rock positions — scattered around the landscape
  const rocks = useMemo(() => {
    const positions: { position: [number, number, number]; scale: number }[] = [];
    for (let i = 0; i < 25; i++) {
      const angle = (i / 25) * Math.PI * 2 + Math.random() * 0.8;
      const radius = 90 + Math.random() * 180;
      positions.push({
        position: [
          Math.cos(angle) * radius,
          0.5,
          Math.sin(angle) * radius,
        ],
        scale: 0.5 + Math.random() * 1.2,
      });
    }
    return positions;
  }, []);

  // Generate cloud positions — spread across the wider sky
  const clouds = useMemo(() => {
    const positions: { position: [number, number, number]; scale: number }[] = [];
    for (let i = 0; i < 16; i++) {
      positions.push({
        position: [
          (Math.random() - 0.5) * 800,
          40 + Math.random() * 40,
          (Math.random() - 0.5) * 800,
        ],
        scale: 1 + Math.random() * 2,
      });
    }
    return positions;
  }, []);

  // Place item boxes along the track (offset from checkpoints)
  const itemBoxes = useMemo(() => {
    const positions: [number, number, number][] = [];
    const n = TRACK_POINTS.length;
    for (let i = 0; i < 8; i++) {
      const idx = Math.floor((i / 8) * n + n / 16) % n;
      const point = TRACK_POINTS[idx];
      positions.push([point.x, 2, point.z]);
    }
    return positions;
  }, []);

  return (
    <group>
      {/* Trees */}
      {trees.map((tree, i) => (
        <Tree key={`tree-${i}`} position={tree.position} scale={tree.scale} />
      ))}

      {/* Rocks */}
      {rocks.map((rock, i) => (
        <Rock key={`rock-${i}`} position={rock.position} scale={rock.scale} />
      ))}

      {/* Clouds */}
      {clouds.map((cloud, i) => (
        <Cloud key={`cloud-${i}`} position={cloud.position} scale={cloud.scale} />
      ))}

      {/* Item Boxes */}
      {itemBoxes.map((pos, i) => (
        <ItemBox key={`item-${i}`} position={pos} />
      ))}

      {/* Mountains in background — pushed much further out */}
      <group>
        {[...Array(12)].map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          const distance = 480;
          return (
            <mesh
              key={`mountain-${i}`}
              position={[
                Math.cos(angle) * distance,
                -10,
                Math.sin(angle) * distance,
              ]}
              rotation={[0, -angle, 0]}
            >
              <coneGeometry args={[50, 100, 4]} />
              <meshStandardMaterial color="#5a6b7c" />
            </mesh>
          );
        })}
      </group>

      {/* Sun */}
      <mesh position={[200, 120, -200]}>
        <sphereGeometry args={[20, 32, 32]} />
        <meshBasicMaterial color="#ffdd44" />
      </mesh>

      {/* Directional light from sun */}
      <directionalLight
        position={[200, 120, -200]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={600}
        shadow-camera-left={-250}
        shadow-camera-right={250}
        shadow-camera-top={250}
        shadow-camera-bottom={-250}
      />

      {/* Ambient light */}
      <ambientLight intensity={0.4} />

      {/* Hemisphere light for sky/ground gradient */}
      <hemisphereLight
        args={['#87CEEB', '#4a7c59', 0.5]}
      />
    </group>
  );
}
