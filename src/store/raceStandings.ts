// Live race standings — a mutable singleton kept OUT of React/Zustand, mirroring
// the carTransform / keys pattern. Every car (player + AI) writes its progress
// here each frame, and the RaceDirector reads + sorts it each frame; neither
// path re-renders React. Only two low-frequency derived values (the player's
// position and the racer count) are pushed into the store for the HUD.
export interface RacerState {
  id: string;
  label: string; // "You", "#2", ...
  isPlayer: boolean;
  color: string;
  lap: number; // 1-based current lap
  progress: number; // lap - 1 + fractionAroundTrack (monotonic, continuous)
  finishTime: number | null; // race time (s) when the final lap was closed
  position: number; // 1-based, filled by recomputeStandings()
}

export const raceStandings: { cars: RacerState[] } = { cars: [] };

// Register the roster when a race starts. Called once by the RaceDirector with
// the player plus every AI, so slot identity/order is stable for the race.
export function initStandings(cars: Omit<RacerState, "position">[]): void {
  raceStandings.cars = cars.map((c) => ({ ...c, position: 0 }));
}

export function getRacer(id: string): RacerState | undefined {
  return raceStandings.cars.find((c) => c.id === id);
}

// Per-frame progress write from a car's own useFrame. No-op before the roster
// is registered (e.g. the very first frames of a race).
export function updateProgress(id: string, lap: number, fraction: number): void {
  const car = getRacer(id);
  if (!car) return;
  car.lap = lap;
  car.progress = lap - 1 + fraction;
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
