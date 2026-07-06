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
  curve: THREE.Curve<THREE.Vector3>;
  t: number; // current progress fraction 0..1
  posX: number;
  posZ: number;
  yaw: number;
  forwardSpeed: number;
  baseMax: number; // difficulty + rubber-band already folded in (m/s)
  trackLength: number; // curve.getLength(), to convert a lookahead distance to t
}

// Produce steering + throttle/brake for one frame. Steering aims at a lookahead
// point on the centerline; throttle/brake track a curvature-limited speed.
export function computeAiInput(args: AiInputArgs): {
  input: KartInput;
  targetSpeed: number;
} {
  const { curve, t, posX, posZ, yaw, forwardSpeed, baseMax, trackLength } = args;

  const lookahead = LOOKAHEAD_BASE + LOOKAHEAD_PER_MS * Math.max(forwardSpeed, 0);
  const tAhead = (t + lookahead / trackLength) % 1;
  const aim = curve.getPoint(tAhead);

  // Signed yaw error to the aim point, wrapped to -pi..pi.
  const desiredYaw = Math.atan2(aim.x - posX, aim.z - posZ);
  let err = desiredYaw - yaw;
  err = Math.atan2(Math.sin(err), Math.cos(err));
  // applyKartForces turns at a yaw rate of the OPPOSITE sign to `steer`
  // (yawRate = -steer·…), so to reduce a positive error we steer negative.
  const steer = Math.max(-1, Math.min(1, -err / STEER_ERROR_SCALE));

  // Curvature: how much the tangent turns between here and the braking horizon.
  // The horizon grows with braking distance so fast approaches see corners in
  // time; sampling two points across it catches the sharpest part of the bend.
  const brakeHorizon =
    BRAKE_HORIZON_BASE +
    (forwardSpeed * forwardSpeed) / (2 * BRAKE_DECEL);
  const tanNow = curve.getTangent(t).normalize();
  const tMid = (t + brakeHorizon / 2 / trackLength) % 1;
  const tFar = (t + brakeHorizon / trackLength) % 1;
  const turnMid = Math.acos(
    Math.max(-1, Math.min(1, tanNow.dot(curve.getTangent(tMid).normalize()))),
  );
  const turnFar = Math.acos(
    Math.max(-1, Math.min(1, tanNow.dot(curve.getTangent(tFar).normalize()))),
  );
  const turn = Math.max(turnMid, turnFar);
  const targetSpeed = curvatureTargetSpeed(baseMax, turn);

  const throttle = forwardSpeed < targetSpeed * 0.98 ? 1 : 0;
  const brake = forwardSpeed > targetSpeed * 1.08 ? 1 : 0;

  return {
    input: { steer, throttle, brake, handbrake: false },
    targetSpeed,
  };
}
