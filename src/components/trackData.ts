import * as THREE from "three";

// ── Racing circuit layout via control points ──
// A proper GP-style circuit with varied corners: fast sweepers, a hairpin,
// S-curves, and long straights.
const CONTROL_POINTS = [
  // Main straight (car starts here, heading +Z)
  new THREE.Vector3(-50, 0, -55),
  new THREE.Vector3(-50, 0, 25),
  // Turn 1 — fast right sweeper
  new THREE.Vector3(-42, 0, 65),
  new THREE.Vector3(-10, 0, 100),
  new THREE.Vector3(30, 0, 108),
  // Turn 2 — medium right
  new THREE.Vector3(65, 0, 92),
  new THREE.Vector3(85, 0, 60),
  // Short straight into hairpin
  new THREE.Vector3(88, 0, 28),
  // Turn 3 — hairpin right
  new THREE.Vector3(85, 0, -2),
  new THREE.Vector3(108, 0, -25),
  new THREE.Vector3(85, 0, -48),
  // S-curves
  new THREE.Vector3(58, 0, -58),
  new THREE.Vector3(32, 0, -42),
  new THREE.Vector3(18, 0, -68),
  // Turn 6 — long left sweeper toward finish
  new THREE.Vector3(-8, 0, -90),
  new THREE.Vector3(-38, 0, -102),
  // Final section back to start
  new THREE.Vector3(-60, 0, -92),
  new THREE.Vector3(-70, 0, -72),
];

export const TRACK_WIDTH = 20;
const TRACK_SEGMENTS = 200;

// Smooth closed spline through control points (centripetal avoids cusps)
const trackCurve = new THREE.CatmullRomCurve3(
  CONTROL_POINTS,
  true, // closed
  "centripetal",
);

const generateTrackPoints = (): THREE.Vector3[] => {
  const pts = trackCurve.getSpacedPoints(TRACK_SEGMENTS);
  // getSpacedPoints returns N+1 points for a closed curve; drop the duplicate
  return pts.slice(0, -1);
};

const generateTrackWidth = (
  points: THREE.Vector3[],
  width: number,
): { left: THREE.Vector3[]; right: THREE.Vector3[] } => {
  const left: THREE.Vector3[] = [];
  const right: THREE.Vector3[] = [];

  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const next = points[(i + 1) % points.length];
    const tangent = new THREE.Vector3().subVectors(next, prev).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    left.push(
      points[i].clone().add(normal.clone().multiplyScalar(width * 0.5)),
    );
    right.push(
      points[i].clone().sub(normal.clone().multiplyScalar(width * 0.5)),
    );
  }

  return { left, right };
};

// Pre-compute so other modules can use them
export const TRACK_POINTS = generateTrackPoints();
export const TRACK_SIDES = generateTrackWidth(TRACK_POINTS, TRACK_WIDTH);

// ── Barrier segment generation along a polyline at fixed arc-length intervals ──
// Samples a closed polyline at every `spacing` world units and returns
// {position, angle, length} for each barrier panel — independently for each side.
export interface BarrierSegment {
  position: THREE.Vector3;
  angle: number;
  length: number;
}

export function generateBarrierSegments(
  polyline: THREE.Vector3[],
  spacing: number,
): BarrierSegment[] {
  const segments: BarrierSegment[] = [];
  const n = polyline.length;

  // Build cumulative arc-length table
  const arcLen: number[] = [0];
  for (let i = 0; i < n; i++) {
    const ni = (i + 1) % n;
    arcLen.push(arcLen[i] + polyline[i].distanceTo(polyline[ni]));
  }
  const totalLen = arcLen[n]; // arc-length of full closed loop

  // Sample at fixed intervals
  let sampleDist = 0;
  let segIdx = 0;

  while (sampleDist < totalLen) {
    const nextDist = Math.min(sampleDist + spacing, totalLen);

    // Find polyline point at sampleDist
    while (segIdx < n - 1 && arcLen[segIdx + 1] < sampleDist) segIdx++;
    const t0 = (sampleDist - arcLen[segIdx]) / (arcLen[segIdx + 1] - arcLen[segIdx]);
    const p0 = new THREE.Vector3().lerpVectors(polyline[segIdx], polyline[(segIdx + 1) % n], t0);

    // Find polyline point at nextDist
    let endIdx = segIdx;
    while (endIdx < n - 1 && arcLen[endIdx + 1] < nextDist) endIdx++;
    const t1 = (nextDist - arcLen[endIdx]) / (arcLen[endIdx + 1] - arcLen[endIdx]);
    const p1 = new THREE.Vector3().lerpVectors(polyline[endIdx], polyline[(endIdx + 1) % n], t1);

    const len = p0.distanceTo(p1);
    if (len > 0.01) {
      segments.push({
        position: new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5),
        angle: Math.atan2(p1.x - p0.x, p1.z - p0.z),
        length: len,
      });
    }

    sampleDist = nextDist;
  }

  return segments;
}

// ── Car spawn helper ──
export function getTrackStart(): {
  position: [number, number, number];
  yaw: number;
} {
  const p0 = TRACK_POINTS[0];
  const p3 = TRACK_POINTS[3]; // look a few points ahead for a stable heading
  const yaw = Math.atan2(p3.x - p0.x, p3.z - p0.z);
  return { position: [p0.x, p0.y + 2, p0.z], yaw };
}

// ── Road surface texture with lane markings ──
export const createRoadTexture = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  // Asphalt base
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(0, 0, 256, 256);

  // Fine grain noise for realism
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const b = 45 + Math.random() * 25;
    ctx.fillStyle = `rgb(${b},${b},${b})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // White edge lines
  ctx.fillStyle = "#dddddd";
  ctx.fillRect(0, 0, 8, 256); // left edge
  ctx.fillRect(248, 0, 8, 256); // right edge

  // Dashed center line
  ctx.fillStyle = "#cccccc";
  for (let y = 0; y < 256; y += 48) {
    ctx.fillRect(124, y, 8, 28);
  }

  return canvas;
};
