import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { useCarPhysics } from "./carPhysics";

interface CarProps {
  position?: [number, number, number];
}

export function Car({ position = [0, 2, 0] }: CarProps) {
  const { carRef, chassisRef, wheelsRef, localSpeed } = useCarPhysics();

  return (
    <RigidBody
      ref={carRef}
      position={position}
      mass={500}
      colliders={false}
      linearDamping={0.3}
      angularDamping={0.8}
      enabledRotations={[false, true, false]}
      restitution={0.3}
      friction={0.7}
    >
      <group ref={chassisRef}>
        {/* Main chassis */}
        <mesh castShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[1.8, 0.6, 3.5]} />
          <meshStandardMaterial color="#e63946" />
        </mesh>

        {/* Car body - top */}
        <mesh castShadow position={[0, 1, -0.3]}>
          <boxGeometry args={[1.4, 0.5, 2]} />
          <meshStandardMaterial color="#d62839" />
        </mesh>

        {/* Windshield */}
        <mesh position={[0, 1.1, 0.8]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[1.2, 0.4, 0.1]} />
          <meshStandardMaterial
            color="#1a1a2e"
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>

        {/* Rear window */}
        <mesh position={[0, 1.1, -1.4]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[1.2, 0.3, 0.1]} />
          <meshStandardMaterial
            color="#1a1a2e"
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>

        {/* Side windows */}
        <mesh position={[0.71, 1, -0.3]}>
          <boxGeometry args={[0.05, 0.4, 1.8]} />
          <meshStandardMaterial
            color="#1a1a2e"
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[-0.71, 1, -0.3]}>
          <boxGeometry args={[0.05, 0.4, 1.8]} />
          <meshStandardMaterial
            color="#1a1a2e"
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>

        {/* Spoiler */}
        <mesh castShadow position={[0, 1.3, -1.6]}>
          <boxGeometry args={[1.6, 0.1, 0.4]} />
          <meshStandardMaterial color="#e63946" />
        </mesh>
        <mesh castShadow position={[0.6, 1, -1.6]}>
          <boxGeometry args={[0.1, 0.6, 0.2]} />
          <meshStandardMaterial color="#d62839" />
        </mesh>
        <mesh castShadow position={[-0.6, 1, -1.6]}>
          <boxGeometry args={[0.1, 0.6, 0.2]} />
          <meshStandardMaterial color="#d62839" />
        </mesh>

        {/* Headlights */}
        <mesh position={[0.6, 0.5, 1.75]}>
          <boxGeometry args={[0.3, 0.2, 0.1]} />
          <meshStandardMaterial
            color="#ffffcc"
            emissive="#ffffaa"
            emissiveIntensity={0.5}
          />
        </mesh>
        <mesh position={[-0.6, 0.5, 1.75]}>
          <boxGeometry args={[0.3, 0.2, 0.1]} />
          <meshStandardMaterial
            color="#ffffcc"
            emissive="#ffffaa"
            emissiveIntensity={0.5}
          />
        </mesh>

        {/* Taillights */}
        <mesh position={[0.6, 0.6, -1.75]}>
          <boxGeometry args={[0.3, 0.15, 0.1]} />
          <meshStandardMaterial
            color="#ff0000"
            emissive="#ff0000"
            emissiveIntensity={0.5}
          />
        </mesh>
        <mesh position={[-0.6, 0.6, -1.75]}>
          <boxGeometry args={[0.3, 0.15, 0.1]} />
          <meshStandardMaterial
            color="#ff0000"
            emissive="#ff0000"
            emissiveIntensity={0.5}
          />
        </mesh>

        {/* Number on side */}
        <mesh position={[0.91, 0.6, 0]}>
          <planeGeometry args={[0.4, 0.4]} />
          <meshBasicMaterial color="#ffffff">
            <canvasTexture
              attach="map"
              image={(() => {
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
                ctx.fillText("1", 32, 32);
                return canvas;
              })()}
            />
          </meshBasicMaterial>
        </mesh>
        <mesh position={[-0.91, 0.6, 0]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.4, 0.4]} />
          <meshBasicMaterial color="#ffffff">
            <canvasTexture
              attach="map"
              image={(() => {
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
                ctx.fillText("1", 32, 32);
                return canvas;
              })()}
            />
          </meshBasicMaterial>
        </mesh>
      </group>

      {/* Wheels */}
      <group ref={wheelsRef}>
        {/* Front Left */}
        <mesh
          castShadow
          position={[0.9, 0.3, 1.2]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.35, 0.35, 0.25, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {/* Front Right */}
        <mesh
          castShadow
          position={[-0.9, 0.3, 1.2]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.35, 0.35, 0.25, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {/* Rear Left */}
        <mesh
          castShadow
          position={[0.9, 0.35, -1.2]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        {/* Rear Right */}
        <mesh
          castShadow
          position={[-0.9, 0.35, -1.2]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      </group>

      {/* Car collider */}
      <CuboidCollider args={[0.9, 0.5, 1.75]} position={[0, 0.6, 0]} />

      {/* Exhaust particles */}
      {localSpeed > 5 && (
        <>
          <group position={[0.4, 0.3, -1.8]}>
            <mesh>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial color="#888888" transparent opacity={0.5} />
            </mesh>
          </group>
          <group position={[-0.4, 0.3, -1.8]}>
            <mesh>
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshBasicMaterial color="#888888" transparent opacity={0.5} />
            </mesh>
          </group>
        </>
      )}
    </RigidBody>
  );
}
