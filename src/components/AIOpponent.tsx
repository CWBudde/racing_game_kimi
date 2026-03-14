import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { getTrackLayout } from "./trackData";
import { useGameStore } from "../store/gameStore";

interface AIOpponentProps {
  color: string;
  carNumber: number;
  startT: number;   // starting position on track [0, 1]
  speedT: number;   // track-fraction advance per second
}

export function AIOpponent({ color, carNumber, startT, speedT }: AIOpponentProps) {
  const rbRef = useRef<RapierRigidBody>(null);
  const tRef = useRef(((startT % 1) + 1) % 1);
  const wheelGroupRef = useRef<THREE.Group>(null);
  const wheelRotRef = useRef(0);

  const { isPlaying, isPaused, selectedCourseId } = useGameStore();
  const trackCurve = useMemo(
    () => getTrackLayout(selectedCourseId).curve,
    [selectedCourseId],
  );

  // Compute initial position/rotation for the RigidBody spawn
  const initialState = useMemo(() => {
    const t0 = ((startT % 1) + 1) % 1;
    const pos = trackCurve.getPoint(t0);
    const tangent = trackCurve.getTangent(t0).normalize();
    const yaw = Math.atan2(tangent.x, tangent.z);
    return {
      position: [pos.x, pos.y + 0.5, pos.z] as [number, number, number],
      rotation: [0, yaw, 0] as [number, number, number],
    };
  }, [startT]);

  const numberCanvas = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 40px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(carNumber), 32, 32);
    return canvas;
  }, [carNumber]);

  useFrame((_, delta) => {
    if (!isPlaying || isPaused || !rbRef.current) return;

    tRef.current = (tRef.current + delta * speedT) % 1;
    const t = tRef.current;

    const pos = trackCurve.getPoint(t);
    const tangent = trackCurve.getTangent(t).normalize();
    const yaw = Math.atan2(tangent.x, tangent.z);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    rbRef.current.setNextKinematicTranslation({ x: pos.x, y: pos.y + 0.5, z: pos.z });
    rbRef.current.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });

    // Animate wheels
    wheelRotRef.current += delta * speedT * 300;
    if (wheelGroupRef.current) {
      wheelGroupRef.current.children.forEach((child) => {
        (child as THREE.Mesh).rotation.x = wheelRotRef.current;
      });
    }
  });

  const darkColor = new THREE.Color(color).multiplyScalar(0.85).getStyle();

  return (
    <RigidBody
      ref={rbRef}
      type="kinematicPosition"
      position={initialState.position}
      rotation={initialState.rotation}
      colliders={false}
    >
      {/* Main chassis */}
      <mesh castShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[1.8, 0.6, 3.5]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Cabin */}
      <mesh castShadow position={[0, 1, -0.3]}>
        <boxGeometry args={[1.4, 0.5, 2]} />
        <meshStandardMaterial color={darkColor} />
      </mesh>

      {/* Windshield */}
      <mesh position={[0, 1.1, 0.8]} rotation={[-0.3, 0, 0]}>
        <boxGeometry args={[1.2, 0.4, 0.1]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Spoiler */}
      <mesh castShadow position={[0, 1.3, -1.6]}>
        <boxGeometry args={[1.6, 0.1, 0.4]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0.6, 1, -1.6]}>
        <boxGeometry args={[0.1, 0.6, 0.2]} />
        <meshStandardMaterial color={darkColor} />
      </mesh>
      <mesh castShadow position={[-0.6, 1, -1.6]}>
        <boxGeometry args={[0.1, 0.6, 0.2]} />
        <meshStandardMaterial color={darkColor} />
      </mesh>

      {/* Headlights */}
      <mesh position={[0.6, 0.5, 1.75]}>
        <boxGeometry args={[0.3, 0.2, 0.1]} />
        <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.6, 0.5, 1.75]}>
        <boxGeometry args={[0.3, 0.2, 0.1]} />
        <meshStandardMaterial color="#ffffcc" emissive="#ffffaa" emissiveIntensity={0.5} />
      </mesh>

      {/* Taillights */}
      <mesh position={[0.6, 0.6, -1.75]}>
        <boxGeometry args={[0.3, 0.15, 0.1]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[-0.6, 0.6, -1.75]}>
        <boxGeometry args={[0.3, 0.15, 0.1]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={0.5} />
      </mesh>

      {/* Car number */}
      <mesh position={[0.91, 0.6, 0]}>
        <planeGeometry args={[0.4, 0.4]} />
        <meshBasicMaterial color="#ffffff">
          <canvasTexture attach="map" image={numberCanvas} />
        </meshBasicMaterial>
      </mesh>
      <mesh position={[-0.91, 0.6, 0]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.4, 0.4]} />
        <meshBasicMaterial color="#ffffff">
          <canvasTexture attach="map" image={numberCanvas} />
        </meshBasicMaterial>
      </mesh>

      {/* Wheels */}
      <group ref={wheelGroupRef}>
        <mesh castShadow position={[0.9, 0.3, 1.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.35, 0.35, 0.25, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh castShadow position={[-0.9, 0.3, 1.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.35, 0.35, 0.25, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh castShadow position={[0.9, 0.35, -1.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh castShadow position={[-0.9, 0.35, -1.2]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>

      {/* Collider — same shape as player car */}
      <CuboidCollider args={[0.9, 0.5, 1.75]} position={[0, 0.6, 0]} />
    </RigidBody>
  );
}
