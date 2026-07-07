import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import {
  createGroundTexture,
  createRoadTexture,
  generateBarrierSegments,
  getTrackLayout,
} from "./trackData";

interface TrackProps {
  trackId: string;
}

export function Track({ trackId }: TrackProps) {
  const trackRef = useRef<THREE.Group>(null);
  const checkpointsRef = useRef<THREE.Group>(null);

  const layout = getTrackLayout(trackId);
  const trackPoints = layout.points;
  const { left, right } = layout.sides;
  const theme = layout.definition.theme;
  const isNeon = theme === "neon";
  const isDesert = theme === "desert";

  const trackGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const n = trackPoints.length;

    // Quad winding depends on which way the control loop runs (CW vs CCW). A
    // loop authored the "other" way would put every face upside down — the
    // road back-face-culls to invisible while still casting a road-shaped
    // shadow. Test the first face's normal and flip the index order if it
    // points down, so both orientations render top-side up.
    const firstNormalY = new THREE.Vector3()
      .subVectors(right[0], left[0])
      .cross(new THREE.Vector3().subVectors(left[1], left[0])).y;
    const flip = firstNormalY < 0;

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

      if (flip) {
        indices.push(baseIndex, baseIndex + 2, baseIndex + 1);
        indices.push(baseIndex + 1, baseIndex + 2, baseIndex + 3);
      } else {
        indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
        indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);
      }

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
    const texture = new THREE.CanvasTexture(createRoadTexture(theme));
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    return texture;
  }, [theme]);

  const groundTexture = useMemo(() => {
    const texture = new THREE.CanvasTexture(createGroundTexture(theme));
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(isNeon ? 24 : 12, isNeon ? 24 : 12);
    texture.anisotropy = 8;
    return texture;
  }, [isNeon, theme]);

  const groundGeometry = useMemo(() => new THREE.PlaneGeometry(1400, 1400, 1, 1), []);

  // Start/finish checkerboard — built once per theme instead of in an inline
  // IIFE that rebuilt a canvas + texture on every render.
  const startLineTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#080c18";
    ctx.fillRect(0, 0, 256, 96);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 8; c++) {
        ctx.fillStyle = isNeon
          ? (r + c) % 2 === 0
            ? "#00f0ff"
            : "#ff3ccf"
          : (r + c) % 2 === 0
            ? "#ffffff"
            : "#000000";
        ctx.fillRect(c * 32, r * 32, 32, 32);
      }
    }
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 253, 93);
    return new THREE.CanvasTexture(canvas);
  }, [isNeon]);

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

  // Barrier-free layouts (forest trails) render and collide with no rails at
  // all — the off-track slowdown is what keeps racing on the road.
  const leftBarrierSegments = useMemo(
    () => (layout.barriers ? generateBarrierSegments(left, 6) : []),
    [left, layout.barriers],
  );
  const rightBarrierSegments = useMemo(
    () => (layout.barriers ? generateBarrierSegments(right, 6) : []),
    [right, layout.barriers],
  );

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
            color={
              isNeon
                ? "#07101c"
                : isDesert
                  ? "#a06a3e"
                  : theme === "forest"
                    ? "#7fbc68"
                    : "#4a7c59"
            }
            roughness={0.95}
            metalness={isNeon ? 0.15 : 0.02}
            emissive={isNeon ? "#061222" : "#000000"}
            emissiveIntensity={isNeon ? 0.28 : 0}
          />
        </mesh>
        <CuboidCollider args={[700, 0.5, 700]} position={[0, -0.6, 0]} />
      </RigidBody>

      <RigidBody type="fixed" colliders="trimesh" friction={0.82}>
        <mesh geometry={trackGeometry} receiveShadow castShadow>
          <meshStandardMaterial
            map={roadTexture}
            roughness={isNeon ? 0.45 : 0.7}
            metalness={isNeon ? 0.35 : 0.1}
            emissive={isNeon ? "#1a2e63" : "#000000"}
            emissiveIntensity={isNeon ? 0.4 : 0}
          />
        </mesh>
      </RigidBody>

      {trackPoints.map((_, i) => {
        if (i % (isNeon ? 4 : 5) !== 0) return null;
        const ni = (i + 1) % trackPoints.length;
        const angle = Math.atan2(
          trackPoints[ni].x - trackPoints[i].x,
          trackPoints[ni].z - trackPoints[i].z,
        );
        const isPrimary = Math.floor(i / (isNeon ? 4 : 5)) % 2 === 0;
        const primaryColor = isNeon ? "#1de7ff" : "#cc2222";
        const secondaryColor = isNeon ? "#ff3ccf" : "#ffffff";

        return (
          <group key={`edge-strip-${i}`}>
            <mesh
              position={[left[i].x, left[i].y + 0.1, left[i].z]}
              rotation={[0, angle, 0]}
            >
              <boxGeometry args={[1.8, 0.14, 3.2]} />
              <meshStandardMaterial
                color={isPrimary ? primaryColor : secondaryColor}
                emissive={isNeon ? (isPrimary ? primaryColor : secondaryColor) : "#000000"}
                emissiveIntensity={isNeon ? 0.8 : 0}
                metalness={isNeon ? 0.3 : 0.05}
              />
            </mesh>
            <mesh
              position={[right[i].x, right[i].y + 0.1, right[i].z]}
              rotation={[0, angle, 0]}
            >
              <boxGeometry args={[1.8, 0.14, 3.2]} />
              <meshStandardMaterial
                color={isPrimary ? secondaryColor : primaryColor}
                emissive={isNeon ? (isPrimary ? secondaryColor : primaryColor) : "#000000"}
                emissiveIntensity={isNeon ? 0.8 : 0}
                metalness={isNeon ? 0.3 : 0.05}
              />
            </mesh>
          </group>
        );
      })}

      {/* Barrier colliders — consolidated from ~260 individual RigidBodies into
          two fixed bodies (one per side), each holding a CuboidCollider per
          segment. Rapier handles many colliders per body cheaply; a body each
          was pure overhead. Visual meshes are rendered separately below. */}
      <RigidBody type="fixed" colliders={false}>
        {leftBarrierSegments.map((seg, i) => (
          <CuboidCollider
            key={`barrier-left-col-${i}`}
            args={[0.275, 0.7, seg.length / 2]}
            position={[seg.position.x, 0.8, seg.position.z]}
            rotation={[0, seg.angle, 0]}
          />
        ))}
        {rightBarrierSegments.map((seg, i) => (
          <CuboidCollider
            key={`barrier-right-col-${i}`}
            args={[0.275, 0.7, seg.length / 2]}
            position={[seg.position.x, 0.8, seg.position.z]}
            rotation={[0, seg.angle, 0]}
          />
        ))}
      </RigidBody>

      {leftBarrierSegments.map((seg, i) => (
        <group
          key={`barrier-left-${i}`}
          position={[seg.position.x, 0.8, seg.position.z]}
          rotation={[0, seg.angle, 0]}
        >
          <mesh castShadow>
            <boxGeometry args={[0.55, 1.4, seg.length]} />
            <meshStandardMaterial
              color={isNeon ? "#0b1020" : i % 2 === 0 ? "#cc3333" : "#bbbbbb"}
              emissive={isNeon ? (i % 2 === 0 ? "#00d9ff" : "#ff3ccf") : "#000000"}
              emissiveIntensity={isNeon ? 0.65 : 0}
              metalness={isNeon ? 0.65 : 0.1}
              roughness={0.35}
            />
          </mesh>
          {isNeon && (
            <mesh position={[0, 0.88, 0]}>
              <boxGeometry args={[0.12, 0.08, seg.length * 0.96]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? "#00efff" : "#ff6ce4"}
                emissive={i % 2 === 0 ? "#00efff" : "#ff6ce4"}
                emissiveIntensity={1.2}
              />
            </mesh>
          )}
        </group>
      ))}

      {rightBarrierSegments.map((seg, i) => (
        <group
          key={`barrier-right-${i}`}
          position={[seg.position.x, 0.8, seg.position.z]}
          rotation={[0, seg.angle, 0]}
        >
          <mesh castShadow>
            <boxGeometry args={[0.55, 1.4, seg.length]} />
            <meshStandardMaterial
              color={isNeon ? "#0b1020" : i % 2 === 0 ? "#cc3333" : "#bbbbbb"}
              emissive={isNeon ? (i % 2 === 0 ? "#ff3ccf" : "#00d9ff") : "#000000"}
              emissiveIntensity={isNeon ? 0.65 : 0}
              metalness={isNeon ? 0.65 : 0.1}
              roughness={0.35}
            />
          </mesh>
          {isNeon && (
            <mesh position={[0, 0.88, 0]}>
              <boxGeometry args={[0.12, 0.08, seg.length * 0.96]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? "#ff6ce4" : "#00efff"}
                emissive={i % 2 === 0 ? "#ff6ce4" : "#00efff"}
                emissiveIntensity={1.2}
              />
            </mesh>
          )}
        </group>
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
                color={isNeon ? (i % 2 === 0 ? "#00e8ff" : "#ff4bd6") : "#ffdd00"}
                emissive={isNeon ? (i % 2 === 0 ? "#00e8ff" : "#ff4bd6") : "#ffaa00"}
                emissiveIntensity={isNeon ? 1 : 0.3}
              />
            </mesh>
            {isNeon && (
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
            )}
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
                  color={isNeon ? "#ffffff" : "#ffff00"}
                  emissive={isNeon ? (j % 2 === 0 ? "#00e8ff" : "#ff4bd6") : "#ffff00"}
                  emissiveIntensity={isNeon ? 1.4 : 0.5}
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
          <planeGeometry args={[layout.width, 8]} />
          <meshStandardMaterial
            map={startLineTexture}
            emissive={isNeon ? "#1f2550" : "#000000"}
            emissiveIntensity={isNeon ? 0.35 : 0}
          />
        </mesh>

        <mesh position={[-10, 5, 0]}>
          <boxGeometry args={[1.2, 10, 1.2]} />
          <meshStandardMaterial
            color={theme === "forest" ? "#7a5b36" : "#0b1122"}
            emissive={theme === "forest" ? "#000000" : "#00d9ff"}
            emissiveIntensity={theme === "forest" ? 0 : 0.7}
            metalness={theme === "forest" ? 0 : 0.7}
            roughness={theme === "forest" ? 0.9 : undefined}
          />
        </mesh>
        <mesh position={[10, 5, 0]}>
          <boxGeometry args={[1.2, 10, 1.2]} />
          <meshStandardMaterial
            color={theme === "forest" ? "#7a5b36" : "#0b1122"}
            emissive={theme === "forest" ? "#000000" : "#ff3ccf"}
            emissiveIntensity={theme === "forest" ? 0 : 0.7}
            metalness={theme === "forest" ? 0 : 0.7}
            roughness={theme === "forest" ? 0.9 : undefined}
          />
        </mesh>
        <mesh position={[0, 9.6, 0]}>
          <boxGeometry args={[22, 0.7, 1.1]} />
          <meshStandardMaterial
            color={theme === "forest" ? "#8a6a40" : "#101935"}
            emissive={theme === "forest" ? "#000000" : "#7d8cff"}
            emissiveIntensity={theme === "forest" ? 0 : 0.8}
            metalness={theme === "forest" ? 0 : 0.6}
            roughness={theme === "forest" ? 0.9 : undefined}
          />
        </mesh>
      </group>
    </group>
  );
}
