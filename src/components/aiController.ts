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

const LOOKAHEAD_BASE = 8; // meters ahead on the line at rest
const LOOKAHEAD_PER_MS = 0.6; // extra meters of lookahead per m/s of speed
const STEER_ERROR_SCALE = 0.6; // rad of yaw error that maps to full lock

// Slow for corners: straight -> full base speed, a right-angle bend -> 35 %.
// Exported for unit testing (Phase 4 · C6).
export function curvatureTargetSpeed(
  baseMax: number,
  turnAngleRad: number,
): number {
  const t = Math.min(Math.abs(turnAngleRad) / (Math.PI / 2), 1);
  return baseMax * (1 - 0.65 * t);
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
  const steer = Math.max(-1, Math.min(1, err / STEER_ERROR_SCALE));

  // Curvature: how much the tangent turns between here and a bit further ahead.
  const tFar = (t + (lookahead * 1.6) / trackLength) % 1;
  const tanNow = curve.getTangent(t).normalize();
  const tanFar = curve.getTangent(tFar).normalize();
  const turn = Math.acos(Math.max(-1, Math.min(1, tanNow.dot(tanFar))));
  const targetSpeed = curvatureTargetSpeed(baseMax, turn);

  const throttle = forwardSpeed < targetSpeed ? 1 : 0;
  const brake = forwardSpeed > targetSpeed * 1.15 ? 1 : 0;

  return {
    input: { steer, throttle, brake, handbrake: false },
    targetSpeed,
  };
}
