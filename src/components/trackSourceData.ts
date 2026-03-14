export interface TrackSourceDataEntry {
  id: string;
  name: string;
  location: string;
  difficulty: string;
  laps: number;
  description: string;
  controlPoints: Array<[number, number, number]>;
}

export const TRACK_SOURCES: TrackSourceDataEntry[] = [
  {
    id: "coastal-gp",
    name: "Coastal GP",
    location: "Azure Ridge",
    difficulty: "Intermediate",
    laps: 3,
    description: "Fast sweepers, one heavy hairpin, and a flowing final sector.",
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
      "A longer, faster outer loop with a sweeping infield cutback and a broad canyon exit.",
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
];
