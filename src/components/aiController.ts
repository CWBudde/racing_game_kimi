// AI driving controller — pure functions that turn a car's pose + track into a
// KartInput for the shared force model (kartForces.ts). The AI follows the
// centerline with pure-pursuit steering and eases off the throttle / brakes for
// upcoming curvature. Overtaking emerges from pace differences and contact.
import * as THREE from "three";
import type { KartInput } from "./kartForces";
import type { Difficulty } from "../store/gameStore";

// paceMul scales the AI top speed relative to the player's MAX_SPEED; rubberMax
// is the maximum +/- fraction the rubber-band can add based on the gap to the
// player. Tuned so Normal is a close race and the tiers feel distinct.
export const DIFFICULTY: Record<
  Difficulty,
  { paceMul: number; rubberMax: number }
> = {
  easy: { paceMul: 0.82, rubberMax: 0.06 },
  normal: { paceMul: 0.92, rubberMax: 0.1 },
  hard: { paceMul: 1.0, rubberMax: 0.12 },
};

const LOOKAHEAD_BASE = 5; // meters ahead on the line at rest (steering aim)
const LOOKAHEAD_PER_MS = 0.35; // extra meters of steering lookahead per m/s
const STEER_ERROR_SCALE = 0.7; // rad of yaw error that maps to full lock
// The braking horizon must exceed the braking distance so a corner is seen in
// time to slow for it: a fixed base plus a speed-squared term (v^2 / 2a, with a
// conservative effective decel) that dominates at speed.
const BRAKE_HORIZON_BASE = 14; // meters
const BRAKE_DECEL = 22; // m/s^2 assumed for the horizon (conservative vs BRAKE_FORCE)

// Slow for corners: straight -> full base speed, a right-angle bend -> 25 %.
// Exported for unit testing (Phase 4 · C6).
export function curvatureTargetSpeed(
  baseMax: number,
  turnAngleRad: number,
): number {
  const t = Math.min(Math.abs(turnAngleRad) / (Math.PI / 2), 1);
  return baseMax * (1 - 0.75 * t);
}

// Nudge the AI top speed toward closing the gap to the player: behind -> faster,
// ahead -> slower. `gap` is playerProgress - aiProgress (in laps). Exported for
// unit testing.
export function rubberBand(
  baseMax: number,
  gap: number,
  rubberMax: number,
): number {
  const k = Math.max(-1, Math.min(1, gap * 2));
  return baseMax * (1 + rubberMax * k);
}

export interface AiInputArgs {
  points: THREE.Vector3[]; // arc-length-spaced centerline samples
  idx: number; // nearest centerline sample to the car
  spacing: number; // meters between adjacent samples (trackLength / N)
  posX: number;
  posZ: number;
  yaw: number;
  forwardSpeed: number;
  baseMax: number; // difficulty + rubber-band already folded in (m/s)
}

// Produce steering + throttle/brake for one frame. Everything is measured on the
// arc-length-spaced `points` array via index offsets, so a lookahead expressed
// in meters is exact — unlike curve.getPoint(u), whose parameter u is not
// arc-length and would make the effective lookahead vary along the track.
export function computeAiInput(args: AiInputArgs): {
  input: KartInput;
  targetSpeed: number;
} {
  const { points, idx, spacing, posX, posZ, yaw, forwardSpeed, baseMax } = args;
  const n = points.length;
  const at = (i: number) => points[((i % n) + n) % n];
  const tangentAt = (i: number) => {
    const a = at(i);
    const b = at(i + 1);
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz) || 1;
    return { x: dx / len, z: dz / len };
  };
  const angleBetween = (
    a: { x: number; z: number },
    b: { x: number; z: number },
  ) => Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.z * b.z)));

  // Steering: aim at a point `lookahead` meters ahead along the centerline.
  const lookahead = LOOKAHEAD_BASE + LOOKAHEAD_PER_MS * Math.max(forwardSpeed, 0);
  const kSteer = Math.max(1, Math.round(lookahead / spacing));
  const aim = at(idx + kSteer);
  const desiredYaw = Math.atan2(aim.x - posX, aim.z - posZ);
  let err = desiredYaw - yaw;
  err = Math.atan2(Math.sin(err), Math.cos(err));
  // applyKartForces turns at a yaw rate of the OPPOSITE sign to `steer`
  // (yawRate = -steer·…), so to reduce a positive error we steer negative.
  const steer = Math.max(-1, Math.min(1, -err / STEER_ERROR_SCALE));

  // Curvature over the braking horizon (grows with braking distance so a corner
  // is seen in time); sample two points across it to catch the sharpest part.
  const brakeHorizon =
    BRAKE_HORIZON_BASE + (forwardSpeed * forwardSpeed) / (2 * BRAKE_DECEL);
  const kFar = Math.max(1, Math.round(brakeHorizon / spacing));
  const kMid = Math.max(1, Math.round(kFar / 2));
  const tanNow = tangentAt(idx);
  const turn = Math.max(
    angleBetween(tanNow, tangentAt(idx + kMid)),
    angleBetween(tanNow, tangentAt(idx + kFar)),
  );
  const targetSpeed = curvatureTargetSpeed(baseMax, turn);

  const throttle = forwardSpeed < targetSpeed * 0.98 ? 1 : 0;
  const brake = forwardSpeed > targetSpeed * 1.08 ? 1 : 0;

  return {
    input: { steer, throttle, brake, handbrake: false },
    targetSpeed,
  };
}
