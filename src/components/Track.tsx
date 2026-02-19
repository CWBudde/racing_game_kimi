import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import * as THREE from "three";
import { TRACK_POINTS, TRACK_SIDES, generateBarrierSegments, createRoadTexture } from "./trackData";

// ── Track component ──
export function Track() {
  const trackRef = useRef<THREE.Group>(null);
  const checkpointsRef = useRef<THREE.Group>(null);

  const trackPoints = TRACK_POINTS;
  const { left, right } = TRACK_SIDES;

  // Road surface geometry (closed-loop quad strip with distance-based UVs)
  const trackGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const n = trackPoints.length;

    let cumulativeV = 0;
    for (let i = 0; i < n; i++) {
      const ni = (i + 1) % n;
      const segLen = trackPoints[i].distanceTo(trackPoints[ni]);
      const vScale = 8; // world units per texture repeat
      const v0 = cumulativeV / vScale;
      const v1 = (cumulativeV + segLen) / vScale;

      const baseIndex = i * 4;

      vertices.push(left[i].x, left[i].y, left[i].z);
      vertices.push(right[i].x, right[i].y, right[i].z);
      vertices.push(left[ni].x, left[ni].y, left[ni].z);
      vertices.push(right[ni].x, right[ni].y, right[ni].z);

      uvs.push(0, v0);
      uvs.push(1, v0);
      uvs.push(0, v1);
      uvs.push(1, v1);

      indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
      indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);

      cumulativeV += segLen;
    }

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }, [trackPoints, left, right]);

  // Road texture
  const roadTexture = useMemo(() => {
    const canvas = createRoadTexture();
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }, []);

  // Ground plane — much larger than the track
  const groundGeometry = useMemo(() => {
    return new THREE.PlaneGeometry(1200, 1200, 1, 1);
  }, []);

  // Checkpoints evenly spaced around the circuit
  const checkpoints = useMemo(() => {
    const cp: {
      position: [number, number, number];
      rotation: [number, number, number];
    }[] = [];
    const numCheckpoints = 8;

    for (let i = 0; i < numCheckpoints; i++) {
      const idx = Math.floor((i / numCheckpoints) * trackPoints.length);
      const point = trackPoints[idx];
      const nextPoint = trackPoints[(idx + 1) % trackPoints.length];
      const angle = Math.atan2(nextPoint.x - point.x, nextPoint.z - point.z);

      cp.push({
        position: [point.x, point.y + 3, point.z],
        rotation: [0, angle, 0],
      });
    }

    return cp;
  }, [trackPoints]);

  // Animate checkpoint rings
  useFrame(({ clock }) => {
    if (checkpointsRef.current) {
      checkpointsRef.current.children.forEach((child, i) => {
        child.rotation.y = clock.getElapsedTime() * 2 + i;
      });
    }
  });

  return (
    <group ref={trackRef}>
      {/* ── Ground / Grass ── */}
      <RigidBody type="fixed" colliders={false}>
        <mesh
          geometry={groundGeometry}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.1, 0]}
          receiveShadow
        >
          <meshStandardMaterial color="#4a7c59" roughness={0.9} />
        </mesh>
        <CuboidCollider args={[600, 0.5, 600]} position={[0, -0.6, 0]} />
      </RigidBody>

      {/* ── Road Surface ── */}
      <RigidBody type="fixed" colliders="trimesh" friction={0.8}>
        <mesh geometry={trackGeometry} receiveShadow castShadow>
          <meshStandardMaterial
            map={roadTexture}
            roughness={0.7}
            metalness={0.1}
          />
        </mesh>
      </RigidBody>

      {/* ── Track Curbs — low red/white kerbs along both edges ── */}
      {trackPoints.map((_, i) => {
        if (i % 5 !== 0) return null;
        const ni = (i + 1) % trackPoints.length;
        const angle = Math.atan2(
          trackPoints[ni].x - trackPoints[i].x,
          trackPoints[ni].z - trackPoints[i].z,
        );
        const isRed = Math.floor(i / 5) % 2 === 0;

        return (
          <group key={`curb-${i}`}>
            {/* Left kerb */}
            <mesh
              position={[left[i].x, 0.08, left[i].z]}
              rotation={[0, angle, 0]}
            >
              <boxGeometry args={[1.5, 0.15, 3]} />
              <meshStandardMaterial color={isRed ? "#cc2222" : "#ffffff"} />
            </mesh>
            {/* Right kerb */}
            <mesh
              position={[right[i].x, 0.08, right[i].z]}
              rotation={[0, angle, 0]}
            >
              <boxGeometry args={[1.5, 0.15, 3]} />
              <meshStandardMaterial color={isRed ? "#cc2222" : "#ffffff"} />
            </mesh>
          </group>
        );
      })}

      {/* ── Barrier Walls — arc-length sampled independently per side ── */}
      {useMemo(() => generateBarrierSegments(left, 8), [left]).map((seg, i) => (
        <RigidBody
          key={`barrier-left-${i}`}
          type="fixed"
          position={[seg.position.x, 0.5, seg.position.z]}
          rotation={[0, seg.angle, 0]}
        >
          <mesh castShadow>
            <boxGeometry args={[0.5, 1.0, seg.length]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#cc3333" : "#bbbbbb"} />
          </mesh>
          <CuboidCollider args={[0.25, 0.5, seg.length / 2]} />
        </RigidBody>
      ))}
      {useMemo(() => generateBarrierSegments(right, 8), [right]).map((seg, i) => (
        <RigidBody
          key={`barrier-right-${i}`}
          type="fixed"
          position={[seg.position.x, 0.5, seg.position.z]}
          rotation={[0, seg.angle, 0]}
        >
          <mesh castShadow>
            <boxGeometry args={[0.5, 1.0, seg.length]} />
            <meshStandardMaterial color={i % 2 === 0 ? "#cc3333" : "#bbbbbb"} />
          </mesh>
          <CuboidCollider args={[0.25, 0.5, seg.length / 2]} />
        </RigidBody>
      ))}

      {/* ── Checkpoints ── */}
      <group ref={checkpointsRef}>
        {checkpoints.map((cp, i) => (
          <group key={`checkpoint-${i}`} position={cp.position}>
            <mesh castShadow>
              <torusGeometry args={[4, 0.3, 8, 32]} />
              <meshStandardMaterial
                color="#ffdd00"
                emissive="#ffaa00"
                emissiveIntensity={0.3}
              />
            </mesh>
            {[...Array(6)].map((_, j) => (
              <mesh
                key={j}
                position={[
                  Math.sin((j * Math.PI) / 3) * 3,
                  Math.cos((j * Math.PI) / 3) * 1.5,
                  0,
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

      {/* ── Start / Finish Line ── */}
      <group
        position={[trackPoints[0].x, trackPoints[0].y + 0.1, trackPoints[0].z]}
        rotation={[
          0,
          Math.atan2(
            trackPoints[1].x - trackPoints[0].x,
            trackPoints[1].z - trackPoints[0].z,
          ),
          0,
        ]}
      >
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[20, 6]} />
          <meshStandardMaterial>
            <canvasTexture
              attach="map"
              image={(() => {
                const canvas = document.createElement("canvas");
                canvas.width = 256;
                canvas.height = 64;
                const ctx = canvas.getContext("2d")!;
                for (let r = 0; r < 2; r++) {
                  for (let c = 0; c < 8; c++) {
                    ctx.fillStyle = (r + c) % 2 === 0 ? "#ffffff" : "#000000";
                    ctx.fillRect(c * 32, r * 32, 32, 32);
                  }
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
