import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGameStore, type RaceResult } from "../store/gameStore";
import {
  initStandings,
  raceStandings,
  recomputeStandings,
  stampFinish,
  getRacer,
} from "../store/raceStandings";
import { AI_ROSTER } from "./aiRoster";

// Logic-only component (renders null, like CameraController). Registers the race
// roster, computes live standings each frame, pushes the player's position to
// the store at ~10 Hz for the HUD, and builds the finishing-order results table
// when the race ends.
const PLAYER_COLOR = "#e63946"; // the player kart's chassis color (Car.tsx)
const HUD_INTERVAL = 0.1; // seconds between position pushes

export function RaceDirector() {
  const isPlaying = useGameStore((state) => state.isPlaying);
  const isCountingDown = useGameStore((state) => state.isCountingDown);
  const gameOver = useGameStore((state) => state.gameOver);
  const totalLaps = useGameStore((state) => state.totalLaps);
  const updateRacePosition = useGameStore((state) => state.updateRacePosition);
  const setRaceResults = useGameStore((state) => state.setRaceResults);

  const hudAccumRef = useRef(0);

  // Register the roster when a countdown/race begins. The player sits on the
  // start/finish line (fraction 0); each AI uses its grid offset.
  useEffect(() => {
    if (!isPlaying && !isCountingDown) return;
    initStandings([
      {
        id: "player",
        label: "You",
        isPlayer: true,
        color: PLAYER_COLOR,
        startFrac: 0,
      },
      ...AI_ROSTER.map((ai) => ({
        id: ai.id,
        label: ai.label,
        isPlayer: false,
        color: ai.color,
        startFrac: ((ai.startT % 1) + 1) % 1,
      })),
    ]);
    hudAccumRef.current = 0;
  }, [isPlaying, isCountingDown]);

  useFrame((_, delta) => {
    if (!isPlaying) return;
    recomputeStandings();
    hudAccumRef.current += Math.min(delta, 0.1);
    if (hudAccumRef.current >= HUD_INTERVAL) {
      hudAccumRef.current -= HUD_INTERVAL;
      const player = getRacer("player");
      updateRacePosition(player?.position ?? 0, raceStandings.cars.length);
    }
  });

  // Build the results table once the race ends (the player crossing the final
  // line sets gameOver). Cars still racing get an extrapolated finish time from
  // their progress so every row has a comparable number.
  useEffect(() => {
    if (!gameOver) return;
    const total = useGameStore.getState().totalRaceTime;
    stampFinish("player", total);
    for (const car of raceStandings.cars) {
      if (car.finishTime === null) {
        const laps = Math.max(car.progress, 0.001);
        // Route through stampFinish so all finish stamping stays in one place
        // (its null-guard makes this a no-op if a real time was set meanwhile).
        stampFinish(car.id, (total * totalLaps) / laps);
      }
    }
    recomputeStandings();
    const ordered = [...raceStandings.cars].sort(
      (a, b) => a.position - b.position,
    );
    const winnerTime = ordered[0]?.finishTime ?? total;
    const results: RaceResult[] = ordered.map((c) => ({
      id: c.id,
      label: c.label,
      color: c.color,
      isPlayer: c.isPlayer,
      position: c.position,
      totalTime: c.finishTime ?? total,
      gap: (c.finishTime ?? total) - winnerTime,
    }));
    setRaceResults(results);
  }, [gameOver, totalLaps, setRaceResults]);

  return null;
}
