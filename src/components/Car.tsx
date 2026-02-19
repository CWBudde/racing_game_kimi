import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  RigidBody,
  CuboidCollider,
  type RapierRigidBody,
} from "@react-three/rapier";
import * as THREE from "three";
import { useGameStore } from "../store/gameStore";
import {
  keys,
  useKeyboardInput,
  MAX_SPEED,
  MAX_REVERSE_SPEED,
  ACCELERATION,
  DECELERATION,
  BRAKE_FORCE,
  STEERING_SPEED,
  MAX_STEERING_ANGLE,
  BOOST_MULTIPLIER,
  getYawFromQuaternion,
} from "./carPhysics";

interface CarProps {
  position?: [number, number, number];
}

export function Car({ position = [0, 2, 0] }: CarProps) {
  const carRef = useRef<RapierRigidBody>(null);
  const chassisRef = useRef<THREE.Group>(null);
  const wheelsRef = useRef<THREE.Group>(null);

  const {
    isPlaying,
    isPaused,
    updateSpeed,
    updateCarPosition,
    updateCarRotation,
    boostAmount,
    updateBoost,
  } = useGameStore();

  const [localSpeed, setLocalSpeed] = useState(0);
  const steeringRef = useRef(0);

  useKeyboardInput();

  // Physics update
  useFrame((_, delta) => {
    if (!carRef.current || !isPlaying || isPaused) return;

    // Clamp delta to avoid physics explosions on tab-switch
    const dt = Math.min(delta, 0.05);

    const car = carRef.current;
    const currentVel = car.linvel();
    const currentRot = car.rotation();

    // Extract yaw from quaternion
    const yaw = getYawFromQuaternion(currentRot);

    // Forward/right vectors from yaw only (ignore any tilt in quaternion)
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    // Speed decomposition
    const forwardSpeed = currentVel.x * forward.x + currentVel.z * forward.z;
    const lateralSpeed = currentVel.x * right.x + currentVel.z * right.z;
    const speed = Math.sqrt(currentVel.x ** 2 + currentVel.z ** 2);

    // --- Steering input (smooth, frame-rate independent) ---
    let targetSteering = 0;
    if (keys.a) targetSteering = -MAX_STEERING_ANGLE;
    if (keys.d) targetSteering = MAX_STEERING_ANGLE;

    // Smooth steering with exponential interpolation
    const steerLerp = 1 - Math.pow(0.001, dt);
    steeringRef.current += (targetSteering - steeringRef.current) * steerLerp;
    const currentSteering = steeringRef.current;

    // --- Acceleration / braking ---
    let acceleration = 0;

    if (keys.w) {
      const boost = keys.shift && boostAmount > 0 ? BOOST_MULTIPLIER : 1;
      if (keys.shift && boostAmount > 0) {
        updateBoost(boostAmount - dt * 20);
      }
      if (forwardSpeed < MAX_SPEED * boost) {
        acceleration = ACCELERATION * boost;
      }
    } else if (keys.s) {
      if (forwardSpeed > 0.5) {
        acceleration = -BRAKE_FORCE;
      } else if (forwardSpeed > -MAX_REVERSE_SPEED) {
        acceleration = -ACCELERATION * 0.5;
      }
    } else {
      // Natural deceleration (drag)
      if (Math.abs(forwardSpeed) > 0.1) {
        acceleration = -Math.sign(forwardSpeed) * DECELERATION;
      }
    }

    // Apply acceleration as impulse along forward direction
    if (Math.abs(acceleration) > 0.1) {
      const forceMag = acceleration * dt * 500; // mass=500
      car.applyImpulse(
        { x: forward.x * forceMag, y: 0, z: forward.z * forceMag },
        true,
      );
    }

    // --- Steering via angular velocity (lets Rapier handle collision response) ---
    if (
      Math.abs(currentSteering) > 0.01 &&
      (Math.abs(speed) > 0.1 || keys.w || keys.s)
    ) {
      // Invert steering when reversing
      const steerSign = forwardSpeed >= 0 ? 1 : -1;
      // Turn rate scales with speed: ramps up from a minimum, reduces at high speed
      const minTurnRate = 0.15;
      const speedFactor = Math.max(
        Math.min(speed / 15, 1) * Math.max(1 - speed / 120, 0.3),
        minTurnRate,
      );
      const angularVelY =
        -currentSteering * STEERING_SPEED * speedFactor * steerSign;
      car.setAngvel({ x: 0, y: angularVelY, z: 0 }, true);
    } else {
      // No steering input — stop angular rotation
      car.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    // --- Lateral grip: gently redirect velocity toward forward direction ---
    // Instead of hard-setting linvel, apply a corrective impulse
    if (Math.abs(lateralSpeed) > 0.2) {
      const gripStrength = keys.space ? 0.4 : 0.85; // handbrake reduces grip
      // Apply a lateral impulse opposing the slide
      const correctionForce = -lateralSpeed * gripStrength * 500 * dt;
      car.applyImpulse(
        { x: right.x * correctionForce, y: 0, z: right.z * correctionForce },
        true,
      );
    }

    // Handbrake: also slow down overall
    if (keys.space) {
      const dampedVel = {
        x: currentVel.x * (1 - 1.5 * dt),
        y: currentVel.y,
        z: currentVel.z * (1 - 1.5 * dt),
      };
      car.setLinvel(dampedVel, true);
    }

    // --- Keep car upright (correct any pitch/roll from collisions) ---
    const uprightRot = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      yaw,
    );
    // Slerp toward upright to avoid snapping
    const currentQuat = new THREE.Quaternion(
      currentRot.x,
      currentRot.y,
      currentRot.z,
      currentRot.w,
    );
    currentQuat.slerp(uprightRot, 0.3);
    car.setRotation(
      {
        x: currentQuat.x,
        y: currentQuat.y,
        z: currentQuat.z,
        w: currentQuat.w,
      },
      true,
    );

    // --- Update game state ---
    const pos = car.translation();
    const finalYaw = getYawFromQuaternion(car.rotation());
    const speedKmh = Math.abs(forwardSpeed) * 3.6;
    updateSpeed(speedKmh);
    setLocalSpeed(speedKmh);
    updateCarPosition([pos.x, pos.y, pos.z]);
    updateCarRotation([0, finalYaw, 0]);

    // Regenerate boost slowly
    if (!keys.shift && boostAmount < 100) {
      updateBoost(boostAmount + dt * 5);
    }

    // --- Animate wheels ---
    if (wheelsRef.current) {
      wheelsRef.current.children.forEach((wheel, i) => {
        wheel.rotation.x += forwardSpeed * dt * 0.5;
        if (i < 2) {
          const steerSign = forwardSpeed >= 0 ? 1 : -1;
          wheel.rotation.y = -currentSteering * steerSign;
        }
      });
    }

    // --- Chassis tilt (cosmetic only) ---
    if (chassisRef.current) {
      const tiltX = Math.min(Math.max(-acceleration * 0.003, -0.08), 0.08);
      const tiltZ = Math.min(
        Math.max(currentSteering * speed * 0.002, -0.1),
        0.1,
      );
      chassisRef.current.rotation.x +=
        (tiltX - chassisRef.current.rotation.x) * 0.1;
      chassisRef.current.rotation.z +=
        (tiltZ - chassisRef.current.rotation.z) * 0.1;
    }
  });

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
