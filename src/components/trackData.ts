import * as THREE from "three";

// A new "neon district" circuit with long straights, a top-end hairpin,
// and a tighter south-side tech section for a cyber-city feel.
const CONTROL_POINTS = [
  new THREE.Vector3(-22, 0, -128),
  new THREE.Vector3(-20, 0, -72),
  new THREE.Vector3(-30, 0, -20),
  new THREE.Vector3(-68, 0, 30),
  new THREE.Vector3(-112, 0, 74),
  new THREE.Vector3(-76, 0, 114),
  new THREE.Vector3(-18, 0, 128),
  new THREE.Vector3(46, 0, 120),
  new THREE.Vector3(98, 0, 88),
  new THREE.Vector3(118, 0, 34),
  new THREE.Vector3(108, 0, -14),
  new THREE.Vector3(78, 0, -54),
  new THREE.Vector3(32, 0, -66),
  new THREE.Vector3(60, 0, -96),
  new THREE.Vector3(84, 0, -132),
  new THREE.Vector3(40, 0, -154),
  new THREE.Vector3(-14, 0, -158),
  new THREE.Vector3(-54, 0, -146),
];

export const TRACK_WIDTH = 22;
const TRACK_SEGMENTS = 240;

const trackCurve = new THREE.CatmullRomCurve3(CONTROL_POINTS, true, "centripetal");

const generateTrackPoints = (): THREE.Vector3[] => {
  const pts = trackCurve.getSpacedPoints(TRACK_SEGMENTS);
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

export const TRACK_POINTS = generateTrackPoints();
export const TRACK_SIDES = generateTrackWidth(TRACK_POINTS, TRACK_WIDTH);

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

  const arcLen: number[] = [0];
  for (let i = 0; i < n; i++) {
    const ni = (i + 1) % n;
    arcLen.push(arcLen[i] + polyline[i].distanceTo(polyline[ni]));
  }
  const totalLen = arcLen[n];

  let sampleDist = 0;
  let segIdx = 0;

  while (sampleDist < totalLen) {
    const nextDist = Math.min(sampleDist + spacing, totalLen);

    while (segIdx < n - 1 && arcLen[segIdx + 1] < sampleDist) segIdx++;
    const t0 = (sampleDist - arcLen[segIdx]) / (arcLen[segIdx + 1] - arcLen[segIdx]);
    const p0 = new THREE.Vector3().lerpVectors(polyline[segIdx], polyline[(segIdx + 1) % n], t0);

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

export function getTrackStart(): {
  position: [number, number, number];
  yaw: number;
} {
  const p0 = TRACK_POINTS[0];
  const p3 = TRACK_POINTS[3];
  const yaw = Math.atan2(p3.x - p0.x, p3.z - p0.z);
  return { position: [p0.x, p0.y + 2, p0.z], yaw };
}

export const createRoadTexture = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  gradient.addColorStop(0, "#05060d");
  gradient.addColorStop(0.5, "#0c1224");
  gradient.addColorStop(1, "#080b16");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const alpha = 0.08 + Math.random() * 0.12;
    const size = 1 + Math.random() * 2;
    ctx.fillStyle = `rgba(110, 180, 255, ${alpha})`;
    ctx.fillRect(x, y, size, size);
  }

  ctx.strokeStyle = "rgba(40, 120, 255, 0.18)";
  ctx.lineWidth = 1;
  for (let y = 0; y <= 512; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#1de7ff";
  ctx.fillRect(0, 0, 14, 512);
  ctx.fillRect(498, 0, 14, 512);

  ctx.fillStyle = "#ff3ccf";
  for (let y = 0; y < 512; y += 56) {
    ctx.fillRect(246, y, 20, 34);
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  for (let y = 16; y < 512; y += 64) {
    ctx.fillRect(80, y, 352, 2);
  }

  return canvas;
};

export const createGroundTexture = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  const gradient = ctx.createRadialGradient(256, 256, 30, 256, 256, 360);
  gradient.addColorStop(0, "#0c1530");
  gradient.addColorStop(0.45, "#08101f");
  gradient.addColorStop(1, "#03050b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = "rgba(0, 255, 240, 0.16)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 512; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  for (let i = 0; i < 120; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 2 + Math.random() * 3;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
    glow.addColorStop(0, "rgba(255, 60, 207, 0.7)");
    glow.addColorStop(1, "rgba(255, 60, 207, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  }

  return canvas;
};
