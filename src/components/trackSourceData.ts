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
      [-20, 0, -150],
      [50, 0, -146],
      [112, 0, -122],
      [150, 0, -78],
      [166, 0, -18],
      [156, 0, 50],
      [122, 0, 114],
      [64, 0, 146],
      [-18, 0, 148],
      [-88, 0, 126],
      [-136, 0, 84],
      [-156, 0, 28],
      [-152, 0, -24],
      [-136, 0, -62],
      [-102, 0, -96],
      [-58, 0, -118],
    ],
  },
];
