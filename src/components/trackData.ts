import * as THREE from "three";
import { TRACK_SOURCES } from "./trackSourceData.js";

export interface TrackDefinition {
  id: string;
  name: string;
  location: string;
  difficulty: string;
  laps: number;
  description: string;
}

export interface BarrierSegment {
  position: THREE.Vector3;
  angle: number;
  length: number;
}

export interface TrackLayout {
  definition: TrackDefinition;
  curve: THREE.CatmullRomCurve3;
  points: THREE.Vector3[];
  sides: {
    left: THREE.Vector3[];
    right: THREE.Vector3[];
  };
  start: {
    position: [number, number, number];
    yaw: number;
  };
}

type TrackSource = TrackDefinition & {
  controlPoints: Array<[number, number, number]>;
};
const trackSources = TRACK_SOURCES as TrackSource[];

export const TRACK_WIDTH = 20;
const TRACK_SEGMENTS = 200;

export const TRACKS: TrackDefinition[] = trackSources.map(
  ({ controlPoints: _controlPoints, ...definition }) => definition,
);

const generateTrackPoints = (curve: THREE.CatmullRomCurve3): THREE.Vector3[] => {
  const pts = curve.getSpacedPoints(TRACK_SEGMENTS);
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

const buildTrackLayout = (source: TrackSource): TrackLayout => {
  const curve = new THREE.CatmullRomCurve3(
    source.controlPoints.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    true,
    "centripetal",
  );
  const points = generateTrackPoints(curve);
  const sides = generateTrackWidth(points, TRACK_WIDTH);
  const p0 = points[0];
  const p3 = points[3];

  return {
    definition: {
      id: source.id,
      name: source.name,
      location: source.location,
      difficulty: source.difficulty,
      laps: source.laps,
      description: source.description,
    },
    curve,
    points,
    sides,
    start: {
      position: [p0.x, p0.y + 2, p0.z],
      yaw: Math.atan2(p3.x - p0.x, p3.z - p0.z),
    },
  };
};

const TRACK_LAYOUTS = Object.fromEntries(
  trackSources.map((source) => [source.id, buildTrackLayout(source)]),
) as Record<string, TrackLayout>;

export const DEFAULT_TRACK_ID = TRACKS[0]?.id ?? "coastal-gp";

export function getTrackLayout(trackId: string): TrackLayout {
  return TRACK_LAYOUTS[trackId] ?? TRACK_LAYOUTS[DEFAULT_TRACK_ID];
}

export function getTrackStart(trackId = DEFAULT_TRACK_ID): {
  position: [number, number, number];
  yaw: number;
} {
  return getTrackLayout(trackId).start;
}

// Samples a closed polyline at fixed intervals and returns barrier panels.
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
    const t0 =
      (sampleDist - arcLen[segIdx]) / (arcLen[segIdx + 1] - arcLen[segIdx]);
    const p0 = new THREE.Vector3().lerpVectors(
      polyline[segIdx],
      polyline[(segIdx + 1) % n],
      t0,
    );

    let endIdx = segIdx;
    while (endIdx < n - 1 && arcLen[endIdx + 1] < nextDist) endIdx++;
    const t1 =
      (nextDist - arcLen[endIdx]) / (arcLen[endIdx + 1] - arcLen[endIdx]);
    const p1 = new THREE.Vector3().lerpVectors(
      polyline[endIdx],
      polyline[(endIdx + 1) % n],
      t1,
    );

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

export const createRoadTexture = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const b = 45 + Math.random() * 25;
    ctx.fillStyle = `rgb(${b},${b},${b})`;
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = "#dddddd";
  ctx.fillRect(0, 0, 8, 256);
  ctx.fillRect(248, 0, 8, 256);

  ctx.fillStyle = "#cccccc";
  for (let y = 0; y < 256; y += 48) {
    ctx.fillRect(124, y, 8, 28);
  }

  return canvas;
};
