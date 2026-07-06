import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { useGameStore } from "../store/gameStore";
import { carTransform, seedCarTransform } from "../store/carTransform";
import { getTrackLayout, getTrackStart } from "./trackData";
import {
  ACCELERATION,
  BOOST_MULTIPLIER,
  CAR_MASS,
  MAX_SPEED,
} from "./carConstants";
import { smoothAlpha } from "./smoothing";
import { applyKartForces } from "./kartForces";

export const keys = {
  w: false,
  a: false,
  s: false,
  d: false,
  space: false,
  shift: false,
  e: false,
  r: false,
};

// Clears every held key. Called on window blur / tab hide / pause so that
// Alt-Tabbing (or pausing) while holding a key doesn't leave the car driving
// itself forever — the browser drops the keyup that would normally release it.
export const resetKeys = () => {
  keys.w = false;
  keys.a = false;
  keys.s = false;
  keys.d = false;
  keys.space = false;
  keys.shift = false;
  keys.e = false;
  keys.r = false;
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
      if (key === "r") keys.r = true;
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
      if (key === "r") keys.r = false;
    };

    // A blurred window / hidden tab stops delivering keyup, so release
    // everything to avoid a stuck-throttle "ghost" input on return.
    const handleBlur = () => resetKeys();
    const handleVisibility = () => {
      if (document.hidden) resetKeys();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibility);
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

// Index of the centerline sample closest to (x, z) — used to snap a respawning
// car back onto the track at the nearest point of the racing line.
const nearestPointIndex = (
  points: THREE.Vector3[],
  x: number,
  z: number,
): number => {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const dx = points[i].x - x;
    const dz = points[i].z - z;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
};

// Height above the world floor before the car is considered fallen off-world
// and auto-respawned.
const FALL_RESET_Y = -10;

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
  const exhaustRef = useRef<THREE.Group>(null);
  const steeringRef = useRef(0);

  // Subscribe only to the low-frequency flags that must drive React re-renders /
  // effects. Everything read per frame (boost, active effect) and every action
  // is pulled from `useGameStore.getState()` inside the frame loop, so the
  // physics loop never re-renders the Car component.
  const isPlaying = useGameStore((state) => state.isPlaying);
  const isPaused = useGameStore((state) => state.isPaused);
  const isCountingDown = useGameStore((state) => state.isCountingDown);
  const selectedTrackId = useGameStore((state) => state.selectedTrackId);

  const nextGateRef = useRef(1);
  const gateAlongRef = useRef<number | null>(null);
  const useItemPressedRef = useRef(false);
  const respawnPressedRef = useRef(false);
  // Accumulates frame time so the HUD speedometer store write happens at ~10 Hz
  // instead of 60 Hz — the gauge doesn't need per-frame precision and each write
  // re-renders the HUD DOM.
  const hudAccumRef = useRef(0);

  const trackLayout = getTrackLayout(selectedTrackId);
  const gates = useMemo(
    () => buildGates(trackLayout.points, trackLayout.width),
    [trackLayout],
  );

  // Seed the transient pose as soon as the countdown begins (not just when the
  // race starts), so the car-following sun and camera anchor to the grid for the
  // whole countdown instead of reading the default (0,0,0) transform.
  useEffect(() => {
    if (isPlaying || isCountingDown) {
      const start = getTrackStart(selectedTrackId);
      seedCarTransform(start.position, start.yaw);
    }
  }, [isPlaying, isCountingDown, selectedTrackId]);

  // Restart the gate sequence and HUD cadence when a race actually starts.
  useEffect(() => {
    if (isPlaying) {
      nextGateRef.current = 1;
      gateAlongRef.current = null;
      hudAccumRef.current = 0;
    }
  }, [isPlaying, selectedTrackId]);

  // Release any held keys when the race pauses or ends, so a key still down at
  // the moment of pausing doesn't silently keep steering/throttling on resume.
  useEffect(() => {
    if (isPaused || !isPlaying) resetKeys();
  }, [isPaused, isPlaying]);

  useKeyboardInput();

  useFrame((_, delta) => {
    if (!carRef.current || !isPlaying || isPaused) return;

    const respawnCar = carRef.current;
    const respawnPos = respawnCar.translation();
    const wantsRespawn = keys.r;
    // Manual respawn (R, edge-triggered) or automatic recovery after falling
    // off the finite ground: snap to the nearest centerline point, face down
    // the track, and kill all momentum.
    if (
      (wantsRespawn && !respawnPressedRef.current) ||
      respawnPos.y < FALL_RESET_Y
    ) {
      const pts = trackLayout.points;
      const idx = nearestPointIndex(pts, respawnPos.x, respawnPos.z);
      const p = pts[idx];
      const n = pts[(idx + 1) % pts.length];
      const respawnYaw = Math.atan2(n.x - p.x, n.z - p.z);
      const respawnQuat = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        respawnYaw,
      );
      respawnCar.setTranslation({ x: p.x, y: p.y + 1.5, z: p.z }, true);
      respawnCar.setRotation(
        {
          x: respawnQuat.x,
          y: respawnQuat.y,
          z: respawnQuat.z,
          w: respawnQuat.w,
        },
        true,
      );
      respawnCar.setLinvel({ x: 0, y: 0, z: 0 }, true);
      respawnCar.setAngvel({ x: 0, y: 0, z: 0 }, true);
      steeringRef.current = 0;
      // Re-seed gate tracking so the teleport can't be read as a gate crossing.
      gateAlongRef.current = null;
      respawnPressedRef.current = wantsRespawn;
      return;
    }
    respawnPressedRef.current = wantsRespawn;

    const dt = Math.min(delta, 0.05);
    // Per-frame store reads/actions go through getState() so this loop never
    // subscribes to (and re-renders on) store changes.
    const store = useGameStore.getState();
    const { boostAmount, activeEffect } = store;
    const car = carRef.current;
    const gamepadInput = readGamepadInput();
    const steeringInput =
      gamepadInput.steer || (keys.a ? -1 : 0) + (keys.d ? 1 : 0);
    const throttleInput = Math.max(keys.w ? 1 : 0, gamepadInput.throttle);
    const brakeInput = Math.max(keys.s ? 1 : 0, gamepadInput.brake);
    const handbrakeActive = keys.space || gamepadInput.handbrake;
    const boostActive = keys.shift || gamepadInput.boost;
    const useItemPressed = keys.e || gamepadInput.useItemBtn;

    if (useItemPressed && !useItemPressedRef.current) {
      store.useItem();
    }
    useItemPressedRef.current = useItemPressed;

    if (activeEffect) {
      store.updateActiveEffect(dt);
    }

    const hasSpeedStar = activeEffect?.type === "speed-star";
    const hasGripBoost = activeEffect?.type === "grip-boost";
    const hasTurbo = activeEffect?.type === "turbo";

    // Boost only applies while throttling; drain matches the pre-refactor loop
    // (only while accelerating with charge left).
    const boostOn = throttleInput > 0 && boostActive && boostAmount > 0;
    if (boostOn) {
      store.updateBoost(boostAmount - dt * 20);
    }
    const boostMul = boostOn ? BOOST_MULTIPLIER : 1;
    const effectiveMaxSpeed =
      (hasSpeedStar ? MAX_SPEED * 1.5 : MAX_SPEED) * boostMul;

    // Turbo stays a player-only extra impulse, applied by the core at the same
    // point in the force sequence as before the refactor.
    const turboImpulse = hasTurbo ? ACCELERATION * 4 * dt * CAR_MASS : 0;

    const { forwardSpeed, speed, acceleration } = applyKartForces(
      car,
      {
        steer: steeringInput,
        throttle: throttleInput,
        brake: brakeInput,
        handbrake: handbrakeActive,
      },
      steeringRef,
      {
        maxSpeed: effectiveMaxSpeed,
        accelMul: boostMul,
        gripBase: hasGripBoost ? 0.95 : 0.85,
      },
      dt,
      turboImpulse,
    );
    const currentSteering = steeringRef.current;

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
          store.completeLap();
        }
      } else {
        gateAlongRef.current = along;
      }
    }

    const pos = car.translation();
    const finalYaw = getYawFromQuaternion(car.rotation());
    const speedKmh = Math.abs(forwardSpeed) * 3.6;

    // Transient pose for the camera — written every frame, no re-render.
    carTransform.x = pos.x;
    carTransform.y = pos.y;
    carTransform.z = pos.z;
    carTransform.yaw = finalYaw;
    carTransform.speedKmh = speedKmh;

    // Toggle exhaust visibility directly instead of via React state, which used
    // to re-render the whole car mesh tree every frame.
    if (exhaustRef.current) {
      exhaustRef.current.visible = speedKmh > 5;
    }

    // Push the speedometer value to the store at ~10 Hz for the HUD. Subtract
    // the interval (rather than resetting to 0) so leftover delta carries into
    // the next window and the cadence doesn't drift with variable frame times.
    hudAccumRef.current += dt;
    if (hudAccumRef.current >= 0.1) {
      hudAccumRef.current -= 0.1;
      store.updateSpeed(speedKmh);
    }

    if (!boostActive && boostAmount < 100) {
      store.updateBoost(boostAmount + dt * 5);
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
      const tiltAlpha = smoothAlpha(0.1, dt);
      chassisRef.current.rotation.x +=
        (tiltX - chassisRef.current.rotation.x) * tiltAlpha;
      chassisRef.current.rotation.z +=
        (tiltZ - chassisRef.current.rotation.z) * tiltAlpha;
    }
  });

  return { carRef, chassisRef, wheelsRef, exhaustRef };
}
