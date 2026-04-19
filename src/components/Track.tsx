import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import {
  TRACK_POINTS,
  TRACK_SIDES,
  createGroundTexture,
  createRoadTexture,
  generateBarrierSegments,
} from "./trackData";

export function Track() {
  const trackRef = useRef<THREE.Group>(null);
  const checkpointsRef = useRef<THREE.Group>(null);

  const trackPoints = TRACK_POINTS;
  const { left, right } = TRACK_SIDES;

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
      const vScale = 8;
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
  }, [left, right, trackPoints]);

  const roadTexture = useMemo(() => {
    const texture = new THREE.CanvasTexture(createRoadTexture());
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    return texture;
  }, []);

  const groundTexture = useMemo(() => {
    const texture = new THREE.CanvasTexture(createGroundTexture());
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(24, 24);
    texture.anisotropy = 8;
    return texture;
  }, []);

  const groundGeometry = useMemo(() => new THREE.PlaneGeometry(1400, 1400, 1, 1), []);

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

  const leftBarrierSegments = useMemo(() => generateBarrierSegments(left, 6), [left]);
  const rightBarrierSegments = useMemo(() => generateBarrierSegments(right, 6), [right]);

  const startAngle = Math.atan2(
    trackPoints[1].x - trackPoints[0].x,
    trackPoints[1].z - trackPoints[0].z,
  );

  useFrame(({ clock }) => {
    if (checkpointsRef.current) {
      checkpointsRef.current.children.forEach((child, i) => {
        child.rotation.y = clock.getElapsedTime() * 1.5 + i * 0.7;
      });
    }
  });

  return (
    <group ref={trackRef}>
      <RigidBody type="fixed" colliders={false}>
        <mesh
          geometry={groundGeometry}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.12, 0]}
          receiveShadow
        >
          <meshStandardMaterial
            map={groundTexture}
            color="#07101c"
            roughness={0.95}
            metalness={0.15}
            emissive="#061222"
            emissiveIntensity={0.28}
          />
        </mesh>
        <CuboidCollider args={[700, 0.5, 700]} position={[0, -0.6, 0]} />
      </RigidBody>

      <RigidBody type="fixed" colliders="trimesh" friction={0.82}>
        <mesh geometry={trackGeometry} receiveShadow castShadow>
          <meshStandardMaterial
            map={roadTexture}
            roughness={0.45}
            metalness={0.35}
            emissive="#1a2e63"
            emissiveIntensity={0.4}
          />
        </mesh>
      </RigidBody>

      {trackPoints.map((_, i) => {
        if (i % 4 !== 0) return null;
        const ni = (i + 1) % trackPoints.length;
        const angle = Math.atan2(
          trackPoints[ni].x - trackPoints[i].x,
          trackPoints[ni].z - trackPoints[i].z,
        );
        const isCyan = Math.floor(i / 4) % 2 === 0;

        return (
          <group key={`edge-strip-${i}`}>
            <mesh position={[left[i].x, 0.1, left[i].z]} rotation={[0, angle, 0]}>
              <boxGeometry args={[1.8, 0.14, 3.2]} />
              <meshStandardMaterial
                color={isCyan ? "#1de7ff" : "#ff3ccf"}
                emissive={isCyan ? "#1de7ff" : "#ff3ccf"}
                emissiveIntensity={0.8}
                metalness={0.3}
              />
            </mesh>
            <mesh position={[right[i].x, 0.1, right[i].z]} rotation={[0, angle, 0]}>
              <boxGeometry args={[1.8, 0.14, 3.2]} />
              <meshStandardMaterial
                color={isCyan ? "#ff3ccf" : "#1de7ff"}
                emissive={isCyan ? "#ff3ccf" : "#1de7ff"}
                emissiveIntensity={0.8}
                metalness={0.3}
              />
            </mesh>
          </group>
        );
      })}

      {leftBarrierSegments.map((seg, i) => (
        <RigidBody
          key={`barrier-left-${i}`}
          type="fixed"
          position={[seg.position.x, 0.8, seg.position.z]}
          rotation={[0, seg.angle, 0]}
        >
          <mesh castShadow>
            <boxGeometry args={[0.55, 1.4, seg.length]} />
            <meshStandardMaterial
              color="#0b1020"
              emissive={i % 2 === 0 ? "#00d9ff" : "#ff3ccf"}
              emissiveIntensity={0.65}
              metalness={0.65}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[0, 0.88, 0]}>
            <boxGeometry args={[0.12, 0.08, seg.length * 0.96]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#00efff" : "#ff6ce4"}
              emissive={i % 2 === 0 ? "#00efff" : "#ff6ce4"}
              emissiveIntensity={1.2}
            />
          </mesh>
          <CuboidCollider args={[0.275, 0.7, seg.length / 2]} />
        </RigidBody>
      ))}

      {rightBarrierSegments.map((seg, i) => (
        <RigidBody
          key={`barrier-right-${i}`}
          type="fixed"
          position={[seg.position.x, 0.8, seg.position.z]}
          rotation={[0, seg.angle, 0]}
        >
          <mesh castShadow>
            <boxGeometry args={[0.55, 1.4, seg.length]} />
            <meshStandardMaterial
              color="#0b1020"
              emissive={i % 2 === 0 ? "#ff3ccf" : "#00d9ff"}
              emissiveIntensity={0.65}
              metalness={0.65}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[0, 0.88, 0]}>
            <boxGeometry args={[0.12, 0.08, seg.length * 0.96]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? "#ff6ce4" : "#00efff"}
              emissive={i % 2 === 0 ? "#ff6ce4" : "#00efff"}
              emissiveIntensity={1.2}
            />
          </mesh>
          <CuboidCollider args={[0.275, 0.7, seg.length / 2]} />
        </RigidBody>
      ))}

      <group ref={checkpointsRef}>
        {checkpoints.map((cp, i) => (
          <group
            key={`checkpoint-${i}`}
            position={cp.position}
            rotation={cp.rotation}
          >
            <mesh castShadow>
              <torusGeometry args={[4.6, 0.28, 10, 48]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? "#00e8ff" : "#ff4bd6"}
                emissive={i % 2 === 0 ? "#00e8ff" : "#ff4bd6"}
                emissiveIntensity={1}
              />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[2.9, 0.18, 8, 32]} />
              <meshStandardMaterial
                color="#8efbff"
                emissive="#8efbff"
                emissiveIntensity={0.9}
                transparent
                opacity={0.75}
              />
            </mesh>
            {[...Array(6)].map((_, j) => (
              <mesh
                key={j}
                position={[
                  Math.sin((j * Math.PI) / 3) * 3.2,
                  Math.cos((j * Math.PI) / 3) * 1.8,
                  0,
                ]}
              >
                <sphereGeometry args={[0.18, 10, 10]} />
                <meshStandardMaterial
                  color="#ffffff"
                  emissive={j % 2 === 0 ? "#00e8ff" : "#ff4bd6"}
                  emissiveIntensity={1.4}
                />
              </mesh>
            ))}
          </group>
        ))}
      </group>

      <group
        position={[trackPoints[0].x, trackPoints[0].y + 0.1, trackPoints[0].z]}
        rotation={[0, startAngle, 0]}
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[22, 8]} />
          <meshStandardMaterial emissive="#1f2550" emissiveIntensity={0.35}>
            <canvasTexture
              attach="map"
              image={(() => {
                const canvas = document.createElement("canvas");
                canvas.width = 256;
                canvas.height = 96;
                const ctx = canvas.getContext("2d")!;
                ctx.fillStyle = "#080c18";
                ctx.fillRect(0, 0, 256, 96);
                for (let r = 0; r < 3; r++) {
                  for (let c = 0; c < 8; c++) {
                    ctx.fillStyle = (r + c) % 2 === 0 ? "#00f0ff" : "#ff3ccf";
                    ctx.fillRect(c * 32, r * 32, 32, 32);
                  }
                }
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 3;
                ctx.strokeRect(1.5, 1.5, 253, 93);
                return canvas;
              })()}
            />
          </meshStandardMaterial>
        </mesh>

        <mesh position={[-10, 5, 0]}>
          <boxGeometry args={[1.2, 10, 1.2]} />
          <meshStandardMaterial
            color="#0b1122"
            emissive="#00d9ff"
            emissiveIntensity={0.7}
            metalness={0.7}
          />
        </mesh>
        <mesh position={[10, 5, 0]}>
          <boxGeometry args={[1.2, 10, 1.2]} />
          <meshStandardMaterial
            color="#0b1122"
            emissive="#ff3ccf"
            emissiveIntensity={0.7}
            metalness={0.7}
          />
        </mesh>
        <mesh position={[0, 9.6, 0]}>
          <boxGeometry args={[22, 0.7, 1.1]} />
          <meshStandardMaterial
            color="#101935"
            emissive="#7d8cff"
            emissiveIntensity={0.8}
            metalness={0.6}
          />
        </mesh>
      </group>
    </group>
  );
}
