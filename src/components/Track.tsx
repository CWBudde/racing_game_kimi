import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';

// Generate track points in a figure-8 or oval shape
const generateTrackPoints = (): THREE.Vector3[] => {
  const points: THREE.Vector3[] = [];
  const segments = 100;
  
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    // Figure-8 track shape
    const x = Math.sin(t) * 60 + Math.sin(t * 3) * 15;
    const z = Math.cos(t * 2) * 40;
    const y = Math.sin(t * 4) * 2; // Slight elevation changes
    points.push(new THREE.Vector3(x, y, z));
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

export function Track() {
  const trackRef = useRef<THREE.Group>(null);
  const checkpointsRef = useRef<THREE.Group>(null);
  
  const trackPoints = useMemo(() => generateTrackPoints(), []);
  const { left, right } = useMemo(() => generateTrackWidth(trackPoints, 20), [trackPoints]);
  
  // Create track geometry
  const trackGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    
    for (let i = 0; i < trackPoints.length - 1; i++) {
      const l1 = left[i];
      const l2 = left[i + 1];
      const r1 = right[i];
      const r2 = right[i + 1];
      
      const baseIndex = i * 4;
      
      // Add vertices
      vertices.push(l1.x, l1.y, l1.z);
      vertices.push(r1.x, r1.y, r1.z);
      vertices.push(l2.x, l2.y, l2.z);
      vertices.push(r2.x, r2.y, r2.z);
      
      // Add UVs
      uvs.push(0, i / trackPoints.length);
      uvs.push(1, i / trackPoints.length);
      uvs.push(0, (i + 1) / trackPoints.length);
      uvs.push(1, (i + 1) / trackPoints.length);
      
      // Add indices (two triangles per segment)
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
          position={[0, -0.5, 0]}
          receiveShadow
        >
          <meshStandardMaterial 
            color="#4a7c59" 
            roughness={0.9}
          />
        </mesh>
        <CuboidCollider args={[150, 0.5, 150]} position={[0, -1, 0]} />
      </RigidBody>
      
      {/* Road Surface */}
      <RigidBody type="fixed" colliders={false}>
        <mesh geometry={trackGeometry} receiveShadow castShadow>
          <meshStandardMaterial 
            color="#333333" 
            roughness={0.7}
            metalness={0.1}
          />
        </mesh>
        {/* Road collider - simplified as a series of boxes */}
        {trackPoints.map((point, i) => {
          if (i % 5 !== 0) return null; // Only every 5th point for performance
          const nextPoint = trackPoints[(i + 1) % trackPoints.length];
          const midPoint = point.clone().add(nextPoint).multiplyScalar(0.5);
          const distance = point.distanceTo(nextPoint) * 5;
          const angle = Math.atan2(nextPoint.x - point.x, nextPoint.z - point.z);
          
          return (
            <CuboidCollider 
              key={i}
              args={[10, 0.5, distance / 2]}
              position={[midPoint.x, midPoint.y, midPoint.z]}
              rotation={[0, angle, 0]}
            />
          );
        })}
      </RigidBody>
      
      {/* Track Borders */}
      {trackPoints.map((_, i) => {
        if (i % 3 !== 0) return null;
        return (
          <group key={`border-${i}`}>
            {/* Left curb */}
            <RigidBody type="fixed" position={[left[i].x, left[i].y + 0.3, left[i].z]}>
              <mesh castShadow>
                <boxGeometry args={[1, 0.6, 4]} />
                <meshStandardMaterial color="#cc3333" />
              </mesh>
              <CuboidCollider args={[0.5, 0.3, 2]} />
            </RigidBody>
            {/* Right curb */}
            <RigidBody type="fixed" position={[right[i].x, right[i].y + 0.3, right[i].z]}>
              <mesh castShadow>
                <boxGeometry args={[1, 0.6, 4]} />
                <meshStandardMaterial color="#cc3333" />
              </mesh>
              <CuboidCollider args={[0.5, 0.3, 2]} />
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
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
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
