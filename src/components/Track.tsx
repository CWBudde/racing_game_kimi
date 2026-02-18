import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';

// Generate track points as a smooth closed circuit (rounded rectangle / racetrack oval)
const generateTrackPoints = (): THREE.Vector3[] => {
  const points: THREE.Vector3[] = [];
  const segments = 120;

  // Rounded-rectangle track: two straights connected by semicircles
  const straightLength = 80; // length of each straight
  const turnRadius = 35;     // radius of each semicircular turn
  // Total perimeter: 2 * straightLength + 2 * PI * turnRadius
  const perimeter = 2 * straightLength + 2 * Math.PI * turnRadius;

  for (let i = 0; i < segments; i++) {
    const d = (i / segments) * perimeter; // distance along track
    let x: number, z: number;

    if (d < straightLength) {
      // Bottom straight (going in +Z direction)
      x = -turnRadius;
      z = -straightLength / 2 + d;
    } else if (d < straightLength + Math.PI * turnRadius) {
      // Right semicircle
      const arcDist = d - straightLength;
      const angle = arcDist / turnRadius; // 0 to PI
      x = -turnRadius + turnRadius * Math.sin(angle);
      z = straightLength / 2 + turnRadius * Math.cos(Math.PI - angle);
    } else if (d < 2 * straightLength + Math.PI * turnRadius) {
      // Top straight (going in -Z direction)
      const straightDist = d - straightLength - Math.PI * turnRadius;
      x = turnRadius;
      z = straightLength / 2 - straightDist;
    } else {
      // Left semicircle
      const arcDist = d - 2 * straightLength - Math.PI * turnRadius;
      const angle = arcDist / turnRadius; // 0 to PI
      x = turnRadius - turnRadius * Math.sin(angle);
      z = -straightLength / 2 - turnRadius * Math.cos(Math.PI - angle);
    }

    points.push(new THREE.Vector3(x, 0, z));
  }

  return points;
};

// Generate track width points for the road surface
const generateTrackWidth = (points: THREE.Vector3[], width: number): { left: THREE.Vector3[]; right: THREE.Vector3[] } => {
  const left: THREE.Vector3[] = [];
  const right: THREE.Vector3[] = [];
  
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const prev = points[(i - 1 + points.length) % points.length];
    
    // Calculate tangent
    const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
    
    // Calculate normal (perpendicular to tangent, horizontal)
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    
    left.push(current.clone().add(normal.clone().multiplyScalar(width / 2)));
    right.push(current.clone().sub(normal.clone().multiplyScalar(width / 2)));
  }
  
  return { left, right };
};

// Pre-compute track points so we can derive start position for the car
const TRACK_POINTS = generateTrackPoints();
const TRACK_WIDTH = 20;
const TRACK_SIDES = generateTrackWidth(TRACK_POINTS, TRACK_WIDTH);

// Exported helper: get start position and yaw for the car
export function getTrackStart(): { position: [number, number, number]; yaw: number } {
  const p0 = TRACK_POINTS[0];
  const p1 = TRACK_POINTS[1];
  const yaw = Math.atan2(p1.x - p0.x, p1.z - p0.z);
  return { position: [p0.x, p0.y + 2, p0.z], yaw };
}

export function Track() {
  const trackRef = useRef<THREE.Group>(null);
  const checkpointsRef = useRef<THREE.Group>(null);

  const trackPoints = TRACK_POINTS;
  const { left, right } = TRACK_SIDES;
  
  // Create track geometry (closed loop)
  const trackGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const n = trackPoints.length;

    for (let i = 0; i < n; i++) {
      const ni = (i + 1) % n;
      const l1 = left[i];
      const l2 = left[ni];
      const r1 = right[i];
      const r2 = right[ni];

      const baseIndex = i * 4;

      vertices.push(l1.x, l1.y, l1.z);
      vertices.push(r1.x, r1.y, r1.z);
      vertices.push(l2.x, l2.y, l2.z);
      vertices.push(r2.x, r2.y, r2.z);

      uvs.push(0, i / n);
      uvs.push(1, i / n);
      uvs.push(0, (i + 1) / n);
      uvs.push(1, (i + 1) / n);

      indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
      indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }, [trackPoints, left, right]);
  
  // Create grass/ground geometry
  const groundGeometry = useMemo(() => {
    return new THREE.PlaneGeometry(300, 300, 1, 1);
  }, []);
  
  // Create checkpoint positions
  const checkpoints = useMemo(() => {
    const cp: { position: [number, number, number]; rotation: [number, number, number] }[] = [];
    const numCheckpoints = 8;
    
    for (let i = 0; i < numCheckpoints; i++) {
      const idx = Math.floor((i / numCheckpoints) * trackPoints.length);
      const point = trackPoints[idx];
      const nextPoint = trackPoints[(idx + 1) % trackPoints.length];
      
      const angle = Math.atan2(nextPoint.x - point.x, nextPoint.z - point.z);
      
      cp.push({
        position: [point.x, point.y + 3, point.z],
        rotation: [0, angle, 0]
      });
    }
    
    return cp;
  }, [trackPoints]);
  
  useFrame(({ clock }) => {
    if (checkpointsRef.current) {
      checkpointsRef.current.children.forEach((child, i) => {
        child.rotation.y = clock.getElapsedTime() * 2 + i;
      });
    }
  });
  
  return (
    <group ref={trackRef}>
      {/* Ground/Grass */}
      <RigidBody type="fixed" colliders={false}>
        <mesh
          geometry={groundGeometry}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.1, 0]}
          receiveShadow
        >
          <meshStandardMaterial
            color="#4a7c59"
            roughness={0.9}
          />
        </mesh>
        <CuboidCollider args={[150, 0.5, 150]} position={[0, -0.6, 0]} />
      </RigidBody>
      
      {/* Road Surface */}
      <RigidBody type="fixed" colliders="trimesh" friction={0.8}>
        <mesh geometry={trackGeometry} receiveShadow castShadow>
          <meshStandardMaterial
            color="#333333"
            roughness={0.7}
            metalness={0.1}
          />
        </mesh>
      </RigidBody>
      
      {/* Track Borders - walls every 6th point to avoid overlapping colliders */}
      {trackPoints.map((_, i) => {
        if (i % 6 !== 0) return null;
        const next = trackPoints[(i + 1) % trackPoints.length];
        const curr = trackPoints[i];
        const angle = Math.atan2(next.x - curr.x, next.z - curr.z);
        const segLen = curr.distanceTo(next) * 6; // cover gap to next wall
        return (
          <group key={`border-${i}`}>
            {/* Left wall */}
            <RigidBody type="fixed" position={[left[i].x, 0.5, left[i].z]} rotation={[0, angle, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.6, 1.0, segLen]} />
                <meshStandardMaterial color={i % 12 === 0 ? '#cc3333' : '#ffffff'} />
              </mesh>
              <CuboidCollider args={[0.3, 0.5, segLen / 2]} />
            </RigidBody>
            {/* Right wall */}
            <RigidBody type="fixed" position={[right[i].x, 0.5, right[i].z]} rotation={[0, angle, 0]}>
              <mesh castShadow>
                <boxGeometry args={[0.6, 1.0, segLen]} />
                <meshStandardMaterial color={i % 12 === 0 ? '#cc3333' : '#ffffff'} />
              </mesh>
              <CuboidCollider args={[0.3, 0.5, segLen / 2]} />
            </RigidBody>
          </group>
        );
      })}
      
      {/* Checkpoints */}
      <group ref={checkpointsRef}>
        {checkpoints.map((cp, i) => (
          <group key={`checkpoint-${i}`} position={cp.position}>
            {/* Checkpoint arch */}
            <mesh castShadow>
              <torusGeometry args={[4, 0.3, 8, 32]} />
              <meshStandardMaterial 
                color="#ffdd00" 
                emissive="#ffaa00"
                emissiveIntensity={0.3}
              />
            </mesh>
            {/* Floating particles */}
            {[...Array(6)].map((_, j) => (
              <mesh 
                key={j}
                position={[
                  Math.sin(j * Math.PI / 3) * 3,
                  Math.cos(j * Math.PI / 3) * 1.5,
                  0
                ]}
              >
                <sphereGeometry args={[0.2, 8, 8]} />
                <meshStandardMaterial 
                  color="#ffff00" 
                  emissive="#ffff00"
                  emissiveIntensity={0.5}
                />
              </mesh>
            ))}
          </group>
        ))}
      </group>
      
      {/* Start/Finish Line */}
      <group position={[trackPoints[0].x, trackPoints[0].y + 0.1, trackPoints[0].z]}>
        <mesh rotation={[-Math.PI / 2, Math.atan2(trackPoints[1].x - trackPoints[0].x, trackPoints[1].z - trackPoints[0].z), 0]} receiveShadow>
          <planeGeometry args={[20, 6]} />
          <meshStandardMaterial>
            <canvasTexture 
              attach="map" 
              image={(() => {
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 64;
                const ctx = canvas.getContext('2d')!;
                for (let i = 0; i < 8; i++) {
                  ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#000000';
                  ctx.fillRect(i * 32, 0, 32, 64);
                }
                return canvas;
              })()}
            />
          </meshStandardMaterial>
        </mesh>
      </group>
    </group>
  );
}
