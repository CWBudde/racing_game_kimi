import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useGameStore } from "../store/gameStore";

// Input state (exported so mobile controller can drive it)
export const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  space: false,
  shift: false,
};

// Setup keyboard listeners
function useKeyboardInput() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "w" || key === "arrowup") keys.w = true;
      if (key === "a" || key === "arrowleft") keys.a = true;
      if (key === "s" || key === "arrowdown") keys.s = true;
      if (key === "d" || key === "arrowright") keys.d = true;
      if (key === " ") keys.space = true;
      if (key === "shift") keys.shift = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "w" || key === "arrowup") keys.w = false;
      if (key === "a" || key === "arrowleft") keys.a = false;
      if (key === "s" || key === "arrowdown") keys.s = false;
      if (key === "d" || key === "arrowright") keys.d = false;
      if (key === " ") keys.space = false;
      if (key === "shift") keys.shift = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);
}

// Car physics constants
const MAX_SPEED = 45;
const MAX_REVERSE_SPEED = 15;
const ACCELERATION = 8;
const DECELERATION = 4;
const BRAKE_FORCE = 35;
const STEERING_SPEED = 5.0;
const MAX_STEERING_ANGLE = 0.8;
const BOOST_MULTIPLIER = 1.5;
export const CAR_MASS = 80;

// Helper to extract Y-axis euler angle from a quaternion
const getYawFromQuaternion = (q: {
  x: number;
  y: number;
  z: number;
  w: number;
}): number => {
  return Math.atan2(
    2 * (q.w * q.y + q.x * q.z),
    1 - 2 * (q.y * q.y + q.z * q.z),
  );
};

// Main physics hook — owns all refs, game store access, and the useFrame loop
export function useCarPhysics() {
  const carRef = useRef<RapierRigidBody>(null);
  const chassisRef = useRef<THREE.Group>(null);
  const wheelsRef = useRef<THREE.Group>(null);
  const steeringRef = useRef(0);

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

    // --- DEBUG: log velocity when coasting ---
    if (!keys.w && !keys.s && Math.abs(forwardSpeed) > 0.05) {
      console.log(
        `coast: fwdSpeed=${forwardSpeed.toFixed(3)} speed=${speed.toFixed(3)} vel=(${currentVel.x.toFixed(2)}, ${currentVel.z.toFixed(2)}) yaw=${yaw.toFixed(3)}`,
      );
    }

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
      // Coasting — no keys pressed
      // Directly damp velocity (stable, can never overshoot zero)
      const dampFactor = Math.exp(-DECELERATION * 0.15 * dt);
      car.setLinvel(
        {
          x: currentVel.x * dampFactor,
          y: currentVel.y,
          z: currentVel.z * dampFactor,
        },
        true,
      );
    }

    // Apply acceleration as impulse along forward direction
    if (Math.abs(acceleration) > 0.1) {
      const forceMag = acceleration * dt * CAR_MASS;
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
      const correctionForce = -lateralSpeed * gripStrength * CAR_MASS * dt;
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

  return { carRef, chassisRef, wheelsRef, localSpeed };
}
