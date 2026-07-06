// Ordered checkpoint gates + centerline helpers, shared by the player
// (carPhysics.ts) and the AI (AIOpponent.tsx) so both count laps identically.
//
// A lap only counts when a car crosses a sequence of gates in order and then
// re-crosses the start/finish line (gate 0). Each gate is a line segment laid
// across the centerline; only the *next expected* gate is tested each frame, so
// sections where the track folds close to itself can't cause a false trigger,
// and cutting across the flat infield misses the outer gates entirely.
import * as THREE from "three";

export const NUM_GATES = 8;
const GATE_LATERAL_MARGIN = 8; // meters of slack beyond the road half-width

export type Gate = {
  cx: number;
  cz: number;
  tx: number; // unit tangent (direction of travel through the gate)
  tz: number;
  halfWidth: number;
};

export const buildGates = (
  points: THREE.Vector3[],
  roadWidth: number,
): Gate[] => {
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
export const gateAlong = (g: Gate, x: number, z: number) =>
  (x - g.cx) * g.tx + (z - g.cz) * g.tz;

// Absolute lateral offset from the gate's center on the road.
export const gateLateral = (g: Gate, x: number, z: number) =>
  Math.abs((x - g.cx) * -g.tz + (z - g.cz) * g.tx);

// Index of the centerline sample closest to (x, z) — used to snap a respawning
// or stuck car back onto the racing line.
export const nearestPointIndex = (
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

// Forward-facing yaw at centerline sample `idx` (toward the next sample).
export const centerlineYaw = (points: THREE.Vector3[], idx: number): number => {
  const p = points[idx];
  const n = points[(idx + 1) % points.length];
  return Math.atan2(n.x - p.x, n.z - p.z);
};
