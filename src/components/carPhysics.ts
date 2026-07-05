import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useGameStore } from "../store/gameStore";
import { getTrackLayout } from "./trackData";

export const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  space: false,
  shift: false,
  e: false,
};

type ControlState = {
  throttle: number;
  brake: number;
  steer: number;
  handbrake: boolean;
  boost: boolean;
  useItemBtn: boolean;
};

const GAMEPAD_DEADZONE = 0.18;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const applyDeadzone = (value: number, deadzone = GAMEPAD_DEADZONE) => {
  if (Math.abs(value) < deadzone) return 0;
  const normalized = (Math.abs(value) - deadzone) / (1 - deadzone);
  return Math.sign(value) * normalized;
};

const readGamepadInput = (): ControlState => {
  if (typeof navigator === "undefined" || !navigator.getGamepads) {
    return {
      throttle: 0,
      brake: 0,
      steer: 0,
      handbrake: false,
      boost: false,
      useItemBtn: false,
    };
  }

  for (const pad of navigator.getGamepads()) {
    if (!pad?.connected) continue;

    const stickSteer = applyDeadzone(pad.axes[0] ?? 0);
    const dpadLeft = pad.buttons[14]?.pressed ? -1 : 0;
    const dpadRight = pad.buttons[15]?.pressed ? 1 : 0;
    const steer = dpadLeft + dpadRight || stickSteer;

    return {
      throttle: clamp(pad.buttons[7]?.value ?? 0, 0, 1),
      brake: clamp(pad.buttons[6]?.value ?? 0, 0, 1),
      steer: clamp(steer, -1, 1),
      handbrake: !!pad.buttons[0]?.pressed,
      boost: !!pad.buttons[5]?.pressed,
      useItemBtn: !!pad.buttons[3]?.pressed,
    };
  }

  return {
    throttle: 0,
    brake: 0,
    steer: 0,
    handbrake: false,
    boost: false,
    useItemBtn: false,
  };
};

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
      if (key === "e") keys.e = true;
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "w" || key === "arrowup") keys.w = false;
      if (key === "a" || key === "arrowleft") keys.a = false;
      if (key === "s" || key === "arrowdown") keys.s = false;
      if (key === "d" || key === "arrowright") keys.d = false;
      if (key === " ") keys.space = false;
      if (key === "shift") keys.shift = false;
      if (key === "e") keys.e = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);
}

// --- Lap validation via ordered checkpoint gates ---------------------------
// A lap only counts when the car crosses a sequence of gates in order and then
// re-crosses the start/finish line (gate 0). Each gate is a line segment laid
// across the centerline; only the *next expected* gate is tested each frame, so
// sections where the track folds close to itself can't cause a false trigger,
// and cutting across the flat infield misses the outer gates entirely.
const NUM_GATES = 8;
const GATE_LATERAL_MARGIN = 8; // meters of slack beyond the road half-width

type Gate = {
  cx: number;
  cz: number;
  tx: number; // unit tangent (direction of travel through the gate)
  tz: number;
  halfWidth: number;
};

const buildGates = (points: THREE.Vector3[], roadWidth: number): Gate[] => {
  const halfWidth = roadWidth * 0.5 + GATE_LATERAL_MARGIN;
  const gates: Gate[] = [];
  for (let i = 0; i < NUM_GATES; i++) {
    const idx = Math.floor((i / NUM_GATES) * points.length);
    const p = points[idx];
    const n = points[(idx + 1) % points.length];
    let tx = n.x - p.x;
    let tz = n.z - p.z;
    const len = Math.hypot(tx, tz) || 1;
    tx /= len;
    tz /= len;
    gates.push({ cx: p.x, cz: p.z, tx, tz, halfWidth });
  }
  return gates;
};

// Signed distance along the direction of travel (negative = still approaching).
const gateAlong = (g: Gate, x: number, z: number) =>
  (x - g.cx) * g.tx + (z - g.cz) * g.tz;

// Absolute lateral offset from the gate's center on the road.
const gateLateral = (g: Gate, x: number, z: number) =>
  Math.abs((x - g.cx) * -g.tz + (z - g.cz) * g.tx);

const MAX_SPEED = 45;
const MAX_REVERSE_SPEED = 15;
const ACCELERATION = 8;
const DECELERATION = 4;
const BRAKE_FORCE = 35;
const STEERING_SPEED = 5.0;
const MAX_STEERING_ANGLE = 0.8;
const BOOST_MULTIPLIER = 1.5;
export const CAR_MASS = 80;

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

export function useCarPhysics() {
  const carRef = useRef<RapierRigidBody>(null);
  const chassisRef = useRef<THREE.Group>(null);
  const wheelsRef = useRef<THREE.Group>(null);
  const steeringRef = useRef(0);

  const {
    isPlaying,
    isPaused,
    selectedTrackId,
    updateSpeed,
    updateCarPosition,
    updateCarRotation,
    boostAmount,
    updateBoost,
    completeLap,
    activeEffect,
    updateActiveEffect,
  } = useGameStore();

  const triggerItem = useGameStore((state) => state.useItem);

  const nextGateRef = useRef(1);
  const gateAlongRef = useRef<number | null>(null);
  const useItemPressedRef = useRef(false);

  const [localSpeed, setLocalSpeed] = useState(0);
  const trackLayout = getTrackLayout(selectedTrackId);
  const gates = useMemo(
    () => buildGates(trackLayout.points, trackLayout.width),
    [trackLayout],
  );

  // Restart the gate sequence whenever a race begins (or the track changes).
  // The car starts on the start/finish line, so the first gate to clear is #1.
  useEffect(() => {
    if (isPlaying) {
      nextGateRef.current = 1;
      gateAlongRef.current = null;
    }
  }, [isPlaying, selectedTrackId]);

  useKeyboardInput();

  useFrame((_, delta) => {
    if (!carRef.current || !isPlaying || isPaused) return;

    const dt = Math.min(delta, 0.05);
    const car = carRef.current;
    const currentVel = car.linvel();
    const currentRot = car.rotation();
    const yaw = getYawFromQuaternion(currentRot);

    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    const forwardSpeed = currentVel.x * forward.x + currentVel.z * forward.z;
    const lateralSpeed = currentVel.x * right.x + currentVel.z * right.z;
    const speed = Math.sqrt(currentVel.x ** 2 + currentVel.z ** 2);
    const gamepadInput = readGamepadInput();
    const steeringInput =
      gamepadInput.steer || (keys.a ? -1 : 0) + (keys.d ? 1 : 0);
    const throttleInput = Math.max(keys.w ? 1 : 0, gamepadInput.throttle);
    const brakeInput = Math.max(keys.s ? 1 : 0, gamepadInput.brake);
    const handbrakeActive = keys.space || gamepadInput.handbrake;
    const boostActive = keys.shift || gamepadInput.boost;
    const useItemPressed = keys.e || gamepadInput.useItemBtn;

    if (useItemPressed && !useItemPressedRef.current) {
      triggerItem();
    }
    useItemPressedRef.current = useItemPressed;

    if (activeEffect) {
      updateActiveEffect(dt);
    }

    const hasSpeedStar = activeEffect?.type === "speed-star";
    const hasGripBoost = activeEffect?.type === "grip-boost";
    const hasTurbo = activeEffect?.type === "turbo";
    const effectiveMaxSpeed = hasSpeedStar ? MAX_SPEED * 1.5 : MAX_SPEED;

    const targetSteering = steeringInput * MAX_STEERING_ANGLE;
    const steerLerp = 1 - Math.pow(0.001, dt);
    steeringRef.current += (targetSteering - steeringRef.current) * steerLerp;
    const currentSteering = steeringRef.current;

    let acceleration = 0;

    if (throttleInput > 0) {
      const boost = boostActive && boostAmount > 0 ? BOOST_MULTIPLIER : 1;
      if (boostActive && boostAmount > 0) {
        updateBoost(boostAmount - dt * 20);
      }
      if (forwardSpeed < effectiveMaxSpeed * boost) {
        acceleration = ACCELERATION * boost * throttleInput;
      }
    } else if (brakeInput > 0) {
      if (forwardSpeed > 0.5) {
        acceleration = -BRAKE_FORCE * brakeInput;
      } else if (forwardSpeed > -MAX_REVERSE_SPEED) {
        acceleration = -ACCELERATION * 0.5 * brakeInput;
      }
    } else {
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

    if (Math.abs(acceleration) > 0.1) {
      const forceMag = acceleration * dt * CAR_MASS;
      car.applyImpulse(
        { x: forward.x * forceMag, y: 0, z: forward.z * forceMag },
        true,
      );
    }

    if (hasTurbo) {
      const turboForce = ACCELERATION * 4 * dt * CAR_MASS;
      car.applyImpulse(
        { x: forward.x * turboForce, y: 0, z: forward.z * turboForce },
        true,
      );
    }

    if (
      Math.abs(currentSteering) > 0.01 &&
      (Math.abs(speed) > 0.1 || throttleInput > 0 || brakeInput > 0)
    ) {
      const steerSign = forwardSpeed >= 0 ? 1 : -1;
      const minTurnRate = 0.15;
      const speedFactor = Math.max(
        Math.min(speed / 15, 1) * Math.max(1 - speed / 120, 0.3),
        minTurnRate,
      );
      const angularVelY =
        -currentSteering * STEERING_SPEED * speedFactor * steerSign;
      car.setAngvel({ x: 0, y: angularVelY, z: 0 }, true);
    } else {
      car.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }

    if (Math.abs(lateralSpeed) > 0.2) {
      const baseGrip = hasGripBoost ? 0.95 : 0.85;
      const gripStrength = handbrakeActive ? 0.4 : baseGrip;
      const correctionForce = -lateralSpeed * gripStrength * CAR_MASS * dt;
      car.applyImpulse(
        { x: right.x * correctionForce, y: 0, z: right.z * correctionForce },
        true,
      );
    }

    if (handbrakeActive) {
      car.setLinvel(
        {
          x: currentVel.x * (1 - 1.5 * dt),
          y: currentVel.y,
          z: currentVel.z * (1 - 1.5 * dt),
        },
        true,
      );
    }

    const uprightRot = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      yaw,
    );
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

    {
      const pos = car.translation();
      const gate = gates[nextGateRef.current];
      const along = gateAlong(gate, pos.x, pos.z);
      const prevAlong = gateAlongRef.current;

      // Cross the gate when we move from behind its plane (along < 0) to in
      // front (along >= 0) while staying within the road's lateral window.
      // Backwards passes (front -> behind) never trigger.
      if (
        prevAlong !== null &&
        prevAlong < 0 &&
        along >= 0 &&
        gateLateral(gate, pos.x, pos.z) < gate.halfWidth
      ) {
        const crossed = nextGateRef.current;
        nextGateRef.current = (crossed + 1) % gates.length;
        // Seed the tracker for the newly expected gate so we don't misfire.
        gateAlongRef.current = gateAlong(
          gates[nextGateRef.current],
          pos.x,
          pos.z,
        );
        // Gate 0 is the start/finish line: crossing it closes a lap.
        if (crossed === 0) {
          completeLap();
        }
      } else {
        gateAlongRef.current = along;
      }
    }

    const pos = car.translation();
    const finalYaw = getYawFromQuaternion(car.rotation());
    const speedKmh = Math.abs(forwardSpeed) * 3.6;
    updateSpeed(speedKmh);
    setLocalSpeed(speedKmh);
    updateCarPosition([pos.x, pos.y, pos.z]);
    updateCarRotation([0, finalYaw, 0]);

    if (!boostActive && boostAmount < 100) {
      updateBoost(boostAmount + dt * 5);
    }

    if (wheelsRef.current) {
      wheelsRef.current.children.forEach((wheel, i) => {
        wheel.rotation.x += forwardSpeed * dt * 0.5;
        if (i < 2) {
          const steerSign = forwardSpeed >= 0 ? 1 : -1;
          wheel.rotation.y = -currentSteering * steerSign;
        }
      });
    }

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
