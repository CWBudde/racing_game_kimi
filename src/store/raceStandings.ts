// Live race standings — a mutable singleton kept OUT of React/Zustand, mirroring
// the carTransform / keys pattern. Every car (player + AI) writes its progress
// here each frame, and the RaceDirector reads + sorts it each frame; neither
// path re-renders React. Only two low-frequency derived values (the player's
// position and the racer count) are pushed into the store for the HUD.
//
// `progress` is a *signed, continuous* position measured in laps from the
// start/finish line, tracked by detecting the centerline fraction wrapping past
// the line. This is robust to grid offsets: a car placed just BEFORE the line
// (fraction ≈ 0.95) reads progress ≈ -0.05 — correctly just behind a car sitting
// on the line (progress 0) — and increases monotonically as it crosses, rather
// than jumping 0.95 → 0. Lap counting for the race result stays authoritative in
// each car's gate logic; `lap` here is only the display value.
export interface RacerState {
  id: string;
  label: string; // "You", "#2", ...
  isPlayer: boolean;
  color: string;
  lap: number; // 1-based display lap (from gate logic)
  progress: number; // signed laps from the start line (ordering metric)
  frac: number; // last centerline fraction 0..1
  wraps: number; // integer line crossings, for the continuous progress
  finishTime: number | null; // race time (s) when the final lap was closed
  position: number; // 1-based, filled by recomputeStandings()
}

export interface RacerSeed {
  id: string;
  label: string;
  isPlayer: boolean;
  color: string;
  startFrac: number; // grid position as a centerline fraction 0..1
}

export const raceStandings: { cars: RacerState[] } = { cars: [] };

// Register the roster when a race starts. Called once by the RaceDirector with
// the player plus every AI, so slot identity/order is stable for the race.
export function initStandings(seeds: RacerSeed[]): void {
  raceStandings.cars = seeds.map((s) => {
    // A grid slot in the second half of the lap sits just before the line, so
    // seed one negative wrap to place it behind a car on the line.
    const wraps = s.startFrac > 0.5 ? -1 : 0;
    return {
      id: s.id,
      label: s.label,
      isPlayer: s.isPlayer,
      color: s.color,
      lap: 1,
      frac: s.startFrac,
      wraps,
      progress: wraps + s.startFrac,
      finishTime: null,
      position: 0,
    };
  });
}

export function getRacer(id: string): RacerState | undefined {
  return raceStandings.cars.find((c) => c.id === id);
}

// Per-frame progress write from a car's own useFrame. No-op before the roster is
// registered. Detects the fraction wrapping across the start/finish line to keep
// `progress` continuous and monotonic.
export function updateProgress(id: string, lap: number, fraction: number): void {
  const car = getRacer(id);
  if (!car) return;
  const delta = fraction - car.frac;
  if (delta < -0.5) car.wraps += 1; // wrapped forward past the line
  else if (delta > 0.5) car.wraps -= 1; // wrapped backward across the line
  car.frac = fraction;
  car.progress = car.wraps + fraction;
  car.lap = lap;
}

// Teleport-safe progress reseed. After a respawn snaps a car to a new point on
// the centerline, its fraction can jump across the start/finish line; calling
// updateProgress then would misread that jump as a lap wrap. Seed the stored
// fraction (leaving `wraps` untouched) so the next updateProgress sees delta ≈ 0.
export function seedProgress(id: string, fraction: number): void {
  const car = getRacer(id);
  if (!car) return;
  car.frac = fraction;
  car.progress = car.wraps + fraction;
}

export function stampFinish(id: string, finishTime: number): void {
  const car = getRacer(id);
  if (!car || car.finishTime !== null) return;
  car.finishTime = finishTime;
}

// Pure: rank a list by finished-first (ascending finish time), then by progress
// descending for cars still racing. Mutates each entry's `position` (1-based)
// and returns the sorted array. Exported for unit testing (Phase 4 · C6).
export function sortStandings(cars: RacerState[]): RacerState[] {
  const ranked = [...cars].sort((a, b) => {
    if (a.finishTime !== null && b.finishTime !== null) {
      return a.finishTime - b.finishTime;
    }
    if (a.finishTime !== null) return -1;
    if (b.finishTime !== null) return 1;
    return b.progress - a.progress;
  });
  ranked.forEach((c, i) => (c.position = i + 1));
  return ranked;
}

export function recomputeStandings(): void {
  sortStandings(raceStandings.cars);
}
