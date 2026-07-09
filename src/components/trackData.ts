import * as THREE from "three";

export type TrackTheme = "classic" | "desert" | "neon" | "forest";

export interface TrackDefinition {
  id: string;
  name: string;
  location: string;
  difficulty: string;
  laps: number;
  description: string;
  theme: TrackTheme;
}

type TrackSource = TrackDefinition & {
  width: number;
  segments: number;
  controlPoints: Array<[number, number, number]>;
  // false = no guard rails: the whole grass field is drivable (the off-track
  // slowdown is the only thing keeping cars honest). Also what makes a
  // self-crossing layout possible — rails would wall off the crossroad.
  barriers?: boolean;
};

export interface BarrierSegment {
  position: THREE.Vector3;
  angle: number;
  length: number;
}

export interface TrackLayout {
  definition: TrackDefinition;
  width: number;
  barriers: boolean;
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

const TRACK_SOURCES: TrackSource[] = [
  {
    id: "neon-district",
    name: "Neon Circuit",
    location: "Grid District",
    difficulty: "Expert",
    laps: 3,
    description:
      "Long cyber-city straights, glowing barriers, and a tight south-side tech sector.",
    theme: "neon",
    width: 22,
    segments: 240,
    controlPoints: [
      [-22, 0, -128],
      [-20, 0, -72],
      [-30, 0, -20],
      [-68, 0, 30],
      [-112, 0, 74],
      [-76, 0, 114],
      [-18, 0, 128],
      [46, 0, 120],
      [98, 0, 88],
      [118, 0, 34],
      [108, 0, -14],
      [78, 0, -54],
      [32, 0, -66],
      [60, 0, -96],
      [84, 0, -132],
      [40, 0, -154],
      [-14, 0, -158],
      [-54, 0, -146],
    ],
  },
  {
    id: "coastal-gp",
    name: "Coastal GP",
    location: "Azure Ridge",
    difficulty: "Intermediate",
    laps: 3,
    description: "Fast sweepers, one heavy hairpin, and a flowing final sector.",
    theme: "classic",
    width: 20,
    segments: 200,
    controlPoints: [
      [-50, 0, -55],
      [-50, 0, 25],
      [-42, 0, 65],
      [-10, 0, 100],
      [30, 0, 108],
      [65, 0, 92],
      [85, 0, 60],
      [88, 0, 28],
      [85, 0, -2],
      [108, 0, -25],
      [85, 0, -48],
      [58, 0, -58],
      [32, 0, -42],
      [18, 0, -68],
      [-8, 0, -90],
      [-38, 0, -102],
      [-60, 0, -92],
      [-70, 0, -72],
    ],
  },
  {
    id: "desert-run",
    name: "Desert Run",
    location: "Red Mesa",
    difficulty: "Advanced",
    laps: 3,
    description:
      "A wide canyon loop with a fast outer arc and a broad infield cutback.",
    theme: "desert",
    width: 20,
    segments: 200,
    controlPoints: [
      [-140, 0, -80],
      [-100, 0, -130],
      [-20, 0, -150],
      [70, 0, -140],
      [130, 0, -100],
      [160, 0, -30],
      [150, 0, 50],
      [110, 0, 120],
      [30, 0, 150],
      [-60, 0, 140],
      [-120, 0, 100],
      [-155, 0, 30],
      [-150, 0, -30],
      [-120, 0, -70],
    ],
  },
  {
    id: "evergreen-trail",
    name: "Evergreen Trail",
    location: "Pinewood Valley",
    difficulty: "Intermediate",
    laps: 3,
    description:
      "A dirt trail winding through dense forest — no rails, and the moss slows anyone who strays.",
    theme: "forest",
    width: 18,
    segments: 200,
    barriers: false,
    controlPoints: [
      [-100, 0, -60],
      [-115, 0, -10],
      [-100, 0, 40],
      [-65, 0, 70],
      [-25, 0, 60],
      [5, 0, 30],
      [45, 0, 25],
      [75, 0, 50],
      [105, 0, 45],
      [125, 0, 5],
      [105, 0, -35],
      [70, 0, -55],
      [35, 0, -40],
      [0, 0, -55],
      [-35, 0, -75],
      [-70, 0, -85],
    ],
  },
  {
    id: "woodland-cross",
    name: "Woodland Cross",
    location: "Twin Glades",
    difficulty: "Advanced",
    laps: 3,
    description:
      "A figure-eight through the woods with a live crossroad — watch for traffic at the junction!",
    theme: "forest",
    width: 18,
    segments: 200,
    barriers: false,
    // The second pass through the junction (control points 10–11) is raised
    // 12 cm so the two overlapping road surfaces don't z-fight; the Catmull-Rom
    // blend spreads it into an imperceptible rise.
    controlPoints: [
      [128, 0, 2],
      [112, 0, -44],
      [62, 0, -58],
      [16, 0, -18],
      [-16, 0, 16],
      [-42, 0, 36],
      [-72, 0, 30],
      [-86, 0, 0],
      [-72, 0, -32],
      [-42, 0, -38],
      [-16, 0.12, -16],
      [16, 0.12, 18],
      [64, 0, 58],
      [112, 0, 46],
    ],
  },
];

export const TRACKS: TrackDefinition[] = TRACK_SOURCES.map((source) => ({
  id: source.id,
  name: source.name,
  location: source.location,
  difficulty: source.difficulty,
  laps: source.laps,
  description: source.description,
  theme: source.theme,
}));

export const DEFAULT_TRACK_ID = "coastal-gp";
export const TRACK_WIDTH = TRACK_SOURCES[0].width;

const generateTrackPoints = (
  curve: THREE.CatmullRomCurve3,
  segments: number,
): THREE.Vector3[] => {
  const pts = curve.getSpacedPoints(segments);
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
  const points = generateTrackPoints(curve, source.segments);
  const sides = generateTrackWidth(points, source.width);
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
      theme: source.theme,
    },
    width: source.width,
    barriers: source.barriers ?? true,
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
  TRACK_SOURCES.map((source) => [source.id, buildTrackLayout(source)]),
) as Record<string, TrackLayout>;

const defaultLayout = TRACK_LAYOUTS[DEFAULT_TRACK_ID];

export const TRACK_POINTS = defaultLayout.points;
export const TRACK_SIDES = defaultLayout.sides;

export function getTrackLayout(trackId: string): TrackLayout {
  return TRACK_LAYOUTS[trackId] ?? defaultLayout;
}

export function getTrackStart(trackId = DEFAULT_TRACK_ID): {
  position: [number, number, number];
  yaw: number;
} {
  return getTrackLayout(trackId).start;
}

// Nearest centerline sample to (x, z): its index, the progress fraction in
// [0, 1) (index / points.length, so it never quite reaches 1), and the XZ
// distance to that sample. One search serves both race-standings progress and
// off-track detection — the samples are dense enough (~1–2 m apart) that the
// nearest-sample distance is a good stand-in for distance from the centerline.
//
// When `prevIndex` is given, only samples within ±`halfWindow` indices of it
// are considered ("sticky" matching). On a self-crossing layout (Woodland
// Cross) a global search is ambiguous at the junction — both legs are equally
// near — and a car would randomly flip to the other leg, corrupting its
// progress and steering. The window keeps it matched to the leg it is actually
// driving; callers fall back to a global search only on real discontinuities
// (respawn/teleport).
export function centerlineSample(
  points: THREE.Vector3[],
  x: number,
  z: number,
  prevIndex?: number | null,
  halfWindow = 24,
): { index: number; fraction: number; distance: number } {
  const n = points.length;
  let best = 0;
  let bestDist = Infinity;
  if (prevIndex !== undefined && prevIndex !== null) {
    for (let k = -halfWindow; k <= halfWindow; k++) {
      const i = (((prevIndex + k) % n) + n) % n;
      const dx = points[i].x - x;
      const dz = points[i].z - z;
      const d = dx * dx + dz * dz;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      const dx = points[i].x - x;
      const dz = points[i].z - z;
      const d = dx * dx + dz * dz;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
  }
  return {
    index: best,
    fraction: best / n,
    distance: Math.sqrt(bestDist),
  };
}

// Fraction in [0, 1) around the centerline of the sample nearest (x, z). Shared
// by the player and AI so race standings order everyone on one progress metric.
// Callers combine this with a lap count for a monotonic race position.
export function progressFraction(
  points: THREE.Vector3[],
  x: number,
  z: number,
): number {
  return centerlineSample(points, x, z).fraction;
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

export const createRoadTexture = (theme: TrackTheme = "neon"): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = theme === "neon" ? 512 : 256;
  canvas.height = theme === "neon" ? 512 : 256;
  const ctx = canvas.getContext("2d")!;

  if (theme === "neon") {
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
  }

  if (theme === "forest") {
    // Packed-dirt forest trail: warm brown base, tan speckle, darker wheel
    // ruts, and pale sandy edge lines instead of painted asphalt markings.
    // Authored bright: canvas textures render markedly darker in the scene
    // (linear sampling + tone mapping), so mid-tone browns sink to mud.
    ctx.fillStyle = "#d3ba8b";
    ctx.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 2400; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const b = 170 + Math.random() * 60;
      ctx.fillStyle = `rgba(${Math.min(b + 30, 255)}, ${b}, ${b - 50}, ${0.25 + Math.random() * 0.3})`;
      ctx.fillRect(x, y, 2, 2);
    }

    ctx.fillStyle = "rgba(150, 122, 82, 0.3)";
    ctx.fillRect(58, 0, 26, 256);
    ctx.fillRect(172, 0, 26, 256);

    ctx.fillStyle = "#f4ecd2";
    ctx.fillRect(0, 0, 7, 256);
    ctx.fillRect(249, 0, 7, 256);

    ctx.fillStyle = "rgba(244, 236, 210, 0.5)";
    for (let y = 0; y < 256; y += 56) {
      ctx.fillRect(125, y, 6, 24);
    }

    return canvas;
  }

  ctx.fillStyle = theme === "desert" ? "#5b4a38" : "#3a3a3a";
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const b =
      theme === "desert" ? 65 + Math.random() * 35 : 45 + Math.random() * 25;
    ctx.fillStyle =
      theme === "desert"
        ? `rgb(${b + 25},${b + 5},${b - 10})`
        : `rgb(${b},${b},${b})`;
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

export const createGroundTexture = (
  theme: TrackTheme = "neon",
): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  if (theme === "neon") {
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
  }

  if (theme === "forest") {
    // Lush meadow floor: saturated green base with grass-blade speckle in
    // several greens and the odd wildflower dot. Kept bright — the mesh tints
    // it with its own green, so a dark base would multiply down to black.
    ctx.fillStyle = "#79b45e";
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 3200; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const alpha = 0.1 + Math.random() * 0.18;
      const pick = Math.random();
      ctx.fillStyle =
        pick < 0.45
          ? `rgba(150, 210, 120, ${alpha})`
          : pick < 0.8
            ? `rgba(96, 158, 76, ${alpha})`
            : `rgba(44, 96, 44, ${alpha})`;
      ctx.fillRect(x, y, 2, 3);
    }

    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle =
        Math.random() < 0.5
          ? "rgba(240, 230, 140, 0.55)"
          : "rgba(230, 240, 250, 0.45)";
      ctx.fillRect(x, y, 2, 2);
    }

    return canvas;
  }

  ctx.fillStyle = theme === "desert" ? "#a06a3e" : "#4a7c59";
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const alpha = 0.08 + Math.random() * 0.12;
    ctx.fillStyle =
      theme === "desert"
        ? `rgba(245, 198, 128, ${alpha})`
        : `rgba(35, 90, 38, ${alpha})`;
    ctx.fillRect(x, y, 2, 2);
  }

  return canvas;
};
