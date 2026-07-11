import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { TRACKS } from "./trackData";
import { ITEM_INFO, useGameStore } from "../store/gameStore";
import { Minimap } from "./Minimap";

const START_SIGNAL_STEPS = 6;
const START_SIGNAL_STEP_MS = 620;

function CountdownOverlay() {
  const startGame = useGameStore((state) => state.startGame);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    let current = 0;
    let timeoutId: ReturnType<typeof setTimeout>;

    const tick = () => {
      current++;
      if (current < START_SIGNAL_STEPS) {
        setPhase(current);
        timeoutId = setTimeout(tick, START_SIGNAL_STEP_MS);
      } else {
        startGame();
      }
    };

    timeoutId = setTimeout(tick, START_SIGNAL_STEP_MS);
    return () => clearTimeout(timeoutId);
  }, [startGame]);

  const isGo = phase === START_SIGNAL_STEPS - 1;
  const redLightsOn = isGo ? 0 : phase + 1;
  const greenLightsOn = isGo ? 5 : 0;

  return (
    <div className="absolute inset-0 flex items-start justify-center z-50 pointer-events-none pt-10 md:pt-14">
      <div className="flex flex-col items-center gap-4">
        <div className="bg-gray-950 border-4 border-gray-700 rounded-xl p-4 shadow-2xl">
          <div className="flex gap-3">
            {Array.from({ length: 5 }, (_, index) => {
              const redActive = index < redLightsOn;
              const greenActive = index < greenLightsOn;
              const color = greenActive ? "#22c55e" : redActive ? "#ef4444" : "#140b0b";
              const shadow = greenActive
                ? "0 0 24px 7px #22c55e99"
                : redActive
                  ? "0 0 24px 7px #ef444499"
                  : "none";

              return (
                <div
                  key={index}
                  className="w-12 h-12 md:w-16 md:h-16 rounded-full border-4 border-gray-800 transition-all duration-150"
                  style={{ background: color, boxShadow: shadow }}
                />
              );
            })}
          </div>
        </div>

        {isGo && (
          <div className="text-6xl md:text-8xl font-black text-green-400 drop-shadow-lg transition-all duration-150 [text-shadow:0_0_40px_#22c55e]">
            GO
          </div>
        )}
      </div>
    </div>
  );
}

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
};

function HighScorePanel() {
  const { highScores, lastRaceRank, selectedTrackId } = useGameStore(
    useShallow((state) => ({
      highScores: state.highScores,
      lastRaceRank: state.lastRaceRank,
      selectedTrackId: state.selectedTrackId,
    })),
  );
  const track = TRACKS.find((t) => t.id === selectedTrackId);

  return (
    <div className="bg-black/30 p-4 rounded-lg text-left">
      <div className="flex items-center justify-between gap-4 mb-3">
        <h3 className="text-yellow-400 font-bold">
          Top 5{track ? ` · ${track.name}` : ""}
        </h3>
        {lastRaceRank && (
          <span className="text-xs text-green-300">
            Leaderboard: #{lastRaceRank}
          </span>
        )}
      </div>

      {highScores.length === 0 ? (
        <div className="text-sm text-gray-300">
          No recorded runs on this track yet.
        </div>
      ) : (
        <div className="space-y-2">
          {highScores.map((score, index) => (
            <div
              key={score.id}
              className="grid grid-cols-[2rem_1fr_auto] gap-3 text-sm text-white"
            >
              <div className="text-yellow-300 font-bold">{index + 1}.</div>
              <div className="font-mono">{formatTime(score.totalTime)}</div>
              <div className="text-gray-400 text-xs">
                Best {formatTime(score.bestLapTime)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GameUI() {
  const {
    showMainMenu,
    isPlaying,
    isPaused,
    gameOver,
    isCountingDown,
    lap,
    totalLaps,
    lapTimes,
    playerPosition,
    racerCount,
    raceResults,
    wrongWay,
    currentLapTime,
    totalRaceTime,
    bestLapTime,
    lastRaceRank,
    selectedTrackId,
    speed,
    maxSpeed,
    boostAmount,
    hasItem,
    currentItem,
    activeEffect,
    difficulty,
    setDifficulty,
    openMainMenu,
    openRaceSetup,
    selectTrack,
    beginCountdown,
    pauseGame,
    resumeGame,
  } = useGameStore(
    useShallow((state) => ({
      showMainMenu: state.showMainMenu,
      isPlaying: state.isPlaying,
      isPaused: state.isPaused,
      gameOver: state.gameOver,
      isCountingDown: state.isCountingDown,
      lap: state.lap,
      totalLaps: state.totalLaps,
      lapTimes: state.lapTimes,
      playerPosition: state.playerPosition,
      racerCount: state.racerCount,
      raceResults: state.raceResults,
      wrongWay: state.wrongWay,
      currentLapTime: state.currentLapTime,
      totalRaceTime: state.totalRaceTime,
      bestLapTime: state.bestLapTime,
      lastRaceRank: state.lastRaceRank,
      selectedTrackId: state.selectedTrackId,
      speed: state.speed,
      maxSpeed: state.maxSpeed,
      boostAmount: state.boostAmount,
      hasItem: state.hasItem,
      currentItem: state.currentItem,
      activeEffect: state.activeEffect,
      difficulty: state.difficulty,
      setDifficulty: state.setDifficulty,
      openMainMenu: state.openMainMenu,
      openRaceSetup: state.openRaceSetup,
      selectTrack: state.selectTrack,
      beginCountdown: state.beginCountdown,
      pauseGame: state.pauseGame,
      resumeGame: state.resumeGame,
    })),
  );
  const selectedTrack =
    TRACKS.find((track) => track.id === selectedTrackId) ?? TRACKS[0];

  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Lap-completion toast (PLAN.md · G5/U1): a grown lapTimes array is a closed
  // lap; a shrink is a race reset and is ignored. Detected via a store
  // subscription rather than in render or in an effect body — the callback
  // runs outside the render cycle (safe under Strict/concurrent rendering) and
  // hands subscribeWithSelector's previous value to the comparison for free.
  // "New best" compares against the earlier laps of THIS race (lap 1 is
  // trivially the best so far and gets no tag); the toast for the
  // second-to-last lap doubles as the "FINAL LAP" callout.
  const [lapToast, setLapToast] = useState<{
    lapNo: number;
    time: number;
    isBest: boolean;
    isFinal: boolean;
  } | null>(null);

  useEffect(
    () =>
      useGameStore.subscribe(
        (state) => state.lapTimes,
        (times, prevTimes) => {
          if (times.length === 0 || times.length <= prevTimes.length) return;
          const time = times[times.length - 1];
          const priorBest = Math.min(...times.slice(0, -1));
          setLapToast({
            lapNo: times.length,
            time,
            isBest: times.length > 1 && time < priorBest,
            isFinal: times.length === useGameStore.getState().totalLaps - 1,
          });
        },
      ),
    [],
  );

  useEffect(() => {
    if (!lapToast) return;
    const id = setTimeout(() => setLapToast(null), 3500);
    return () => clearTimeout(id);
  }, [lapToast]);

  useEffect(() => {
    if (isPlaying && showControls) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 5000);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, showControls]);

  useEffect(() => {
    if (!isPlaying) return;

    const id = setTimeout(() => {
      setShowControls(true);
    }, 0);

    return () => clearTimeout(id);
  }, [isPlaying]);

  if (showMainMenu) {
    return (
      <div className="absolute inset-0 flex items-start md:items-center justify-center bg-black/70 z-50 overflow-y-auto p-4">
        <div className="w-full max-w-5xl bg-gradient-to-br from-cyan-950 via-slate-950 to-fuchsia-950 rounded-2xl border-4 border-cyan-400 shadow-2xl overflow-hidden">
          <div className="grid md:grid-cols-[1.1fr_0.9fr]">
            <div className="p-6 md:p-8 border-b md:border-b-0 md:border-r border-white/10">
              <div className="text-cyan-300 text-sm tracking-[0.35em] uppercase mb-3">
                Track Select
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white leading-none mb-4">
                KART
                <span className="block text-cyan-300">RACING</span>
              </h1>
              <p className="text-slate-200 max-w-xl mb-6">
                Pick a course, review the leaderboard, then continue to race setup.
              </p>

              <div className="space-y-3">
                {TRACKS.map((track) => {
                  const isSelected = track.id === selectedTrackId;
                  const accent =
                    track.theme === "neon"
                      ? "text-cyan-200"
                      : track.theme === "desert"
                        ? "text-orange-200"
                        : "text-green-200";

                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => selectTrack(track.id)}
                      className={`w-full rounded-xl border p-4 text-left transition-all ${
                        isSelected
                          ? "border-cyan-300 bg-cyan-400/15 shadow-[0_0_0_1px_rgba(103,232,249,0.45)]"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xl md:text-2xl font-bold text-white">
                            {track.name}
                          </div>
                          <div className={`text-sm mt-1 ${accent}`}>
                            {track.location}
                          </div>
                        </div>
                        <div className="text-right text-xs uppercase text-slate-300">
                          <div>{track.difficulty}</div>
                          <div>{track.laps} laps</div>
                        </div>
                      </div>
                      <div className="text-sm text-slate-200 mt-3">
                        {track.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6 md:p-8 bg-black/20">
              <div className="rounded-xl border border-cyan-300/30 bg-black/25 p-5 mb-6">
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-200 mb-2">
                  Selected Course
                </div>
                <div className="text-3xl font-bold text-white">
                  {selectedTrack.name}
                </div>
                <div className="text-slate-300 mt-2">
                  {selectedTrack.location} · {selectedTrack.difficulty} ·{" "}
                  {selectedTrack.laps} laps
                </div>
              </div>

              <div className="mb-6">
                <HighScorePanel />
              </div>

              <button
                onClick={openRaceSetup}
                className="w-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-white font-black py-4 px-8 rounded-full text-lg transition-all"
              >
                Continue To Race Setup
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isPlaying && !isCountingDown && !gameOver) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50 p-4">
        <div className="bg-gradient-to-br from-cyan-950 via-slate-950 to-fuchsia-950 p-6 md:p-8 rounded-2xl shadow-2xl text-center max-w-md border-4 border-cyan-400">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2 drop-shadow-lg">
            <span className="text-cyan-300">TRACK</span> READY
          </h1>
          <p className="text-fuchsia-200 mb-2">3D Racing Adventure</p>
          <div className="text-sm text-cyan-100 mb-6">
            Course: <span className="font-bold text-white">{selectedTrack.name}</span>{" "}
            · {selectedTrack.laps} laps
          </div>

          <div className="bg-black/30 p-4 rounded-lg mb-6 text-left">
            <h3 className="text-yellow-400 font-bold mb-2">Controls:</h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-white">
              <div>
                <span className="bg-gray-700 px-2 py-1 rounded">W</span> /{" "}
                <span className="bg-gray-700 px-2 py-1 rounded">↑</span> Accelerate
              </div>
              <div>
                <span className="bg-gray-700 px-2 py-1 rounded">S</span> /{" "}
                <span className="bg-gray-700 px-2 py-1 rounded">↓</span> Brake
              </div>
              <div>
                <span className="bg-gray-700 px-2 py-1 rounded">A</span> /{" "}
                <span className="bg-gray-700 px-2 py-1 rounded">←</span> Left
              </div>
              <div>
                <span className="bg-gray-700 px-2 py-1 rounded">D</span> /{" "}
                <span className="bg-gray-700 px-2 py-1 rounded">→</span> Right
              </div>
              <div>
                <span className="bg-gray-700 px-2 py-1 rounded">SPACE</span>{" "}
                Handbrake
              </div>
              <div>
                <span className="bg-gray-700 px-2 py-1 rounded">SHIFT</span> Boost
              </div>
              <div>
                <span className="bg-gray-700 px-2 py-1 rounded">E</span> Use Item
              </div>
              <div>
                <span className="bg-gray-700 px-2 py-1 rounded">R</span> Respawn
              </div>
            </div>
          </div>

          <div className="mb-6 text-left">
            <h3 className="text-yellow-400 font-bold mb-2">Opponent Difficulty:</h3>
            <div className="grid grid-cols-3 gap-2">
              {(["easy", "normal", "hard"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`py-2 px-3 rounded-lg font-bold capitalize transition-all ${
                    difficulty === level
                      ? "bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-white shadow-lg"
                      : "bg-black/40 text-cyan-100 hover:bg-black/60"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <HighScorePanel />
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={openMainMenu}
              className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-bold py-4 px-8 rounded-full transition-all"
            >
              Back
            </button>
            <button
              onClick={beginCountdown}
              className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-white font-bold py-4 px-10 rounded-full text-xl transition-all transform hover:scale-105 shadow-lg"
            >
              START RACE
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameOver) {
    const bestRaceLap = lapTimes.length > 0 ? Math.min(...lapTimes) : null;
    return (
      <div className="absolute inset-0 flex items-start md:items-center justify-center bg-black/80 z-50 overflow-y-auto p-4">
        <div className="bg-gradient-to-br from-fuchsia-950 via-slate-950 to-cyan-950 p-8 rounded-2xl shadow-2xl text-center max-w-md border-4 border-fuchsia-400">
          <h1 className="text-5xl font-bold text-white mb-4 drop-shadow-lg">
            <span className="text-yellow-400">RACE</span> COMPLETE!
          </h1>

          <div className="bg-black/30 p-4 rounded-lg mb-6">
            <div className="text-2xl text-white mb-2">
              Total Time:{" "}
              <span className="text-yellow-400 font-mono">
                {formatTime(totalRaceTime)}
              </span>
            </div>
            {bestLapTime && (
              <div className="text-lg text-gray-300">
                Best Lap:{" "}
                <span className="text-green-400 font-mono">
                  {formatTime(bestLapTime)}
                </span>
              </div>
            )}
            {lastRaceRank && (
              <div className="text-sm text-blue-300 mt-2">
                Leaderboard position: #{lastRaceRank}
              </div>
            )}
          </div>

          {lapTimes.length > 0 && (
            <div className="bg-black/30 p-4 rounded-lg mb-6 text-left">
              <h3 className="text-yellow-400 font-bold mb-3 text-center">
                Lap Times
              </h3>
              <div className="space-y-1">
                {lapTimes.map((time, index) => {
                  const isBest = time === bestRaceLap;
                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-2 px-2 py-1 rounded ${
                        isBest ? "bg-green-500/15" : ""
                      }`}
                    >
                      <span className="text-gray-300 font-mono w-14">
                        Lap {index + 1}
                      </span>
                      <span
                        className={`flex-1 font-mono ${
                          isBest ? "text-green-400 font-bold" : "text-white"
                        }`}
                      >
                        {formatTime(time)}
                      </span>
                      {isBest && lapTimes.length > 1 && (
                        <span className="text-green-400 text-xs font-bold">
                          BEST LAP
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {raceResults.length > 0 && (
            <div className="bg-black/30 p-4 rounded-lg mb-6 text-left">
              <h3 className="text-yellow-400 font-bold mb-3 text-center">
                Finishing Order
              </h3>
              <div className="space-y-1">
                {raceResults.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center gap-2 px-2 py-1 rounded ${
                      r.isPlayer ? "bg-white/15 font-bold" : ""
                    }`}
                  >
                    <span className="text-gray-300 font-mono w-6">
                      P{r.position}
                    </span>
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: r.color }}
                    />
                    <span className="text-white flex-1">
                      {r.isPlayer ? "You" : r.label}
                    </span>
                    <span className="text-gray-200 font-mono">
                      {formatTime(r.totalTime)}
                    </span>
                    <span className="text-gray-400 font-mono text-sm w-16 text-right">
                      {r.gap > 0 ? `+${r.gap.toFixed(2)}` : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <HighScorePanel />
          </div>

          <div className="flex gap-4 justify-center">
            <button
              onClick={openMainMenu}
              className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-bold py-3 px-8 rounded-full transition-all"
            >
              Main Menu
            </button>
            <button
              onClick={beginCountdown}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-8 rounded-full transition-all"
            >
              Race Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
        <div className="bg-gradient-to-br from-cyan-950 to-fuchsia-950 p-8 rounded-2xl shadow-2xl text-center border-4 border-cyan-300">
          <h1 className="text-4xl font-bold text-white mb-6">PAUSED</h1>
          <div className="flex gap-4 justify-center">
            <button
              onClick={resumeGame}
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-3 px-8 rounded-full transition-all"
            >
              Resume
            </button>
            <button
              onClick={openMainMenu}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3 px-8 rounded-full transition-all"
            >
              Quit
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isCountingDown) {
    return <CountdownOverlay />;
  }

  return (
    <>
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-40 pointer-events-none">
        <div className="flex items-start gap-3">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl p-3 border-2 border-yellow-400">
            <div className="text-yellow-400 text-sm font-bold uppercase tracking-wider">
              Lap
            </div>
            <div className="text-white text-3xl font-mono font-bold">
              {lap}
              <span className="text-gray-400 text-lg">/{totalLaps}</span>
            </div>
          </div>

          {racerCount > 0 && (
            <div className="bg-black/60 backdrop-blur-sm rounded-xl p-3 border-2 border-green-400">
              <div className="text-green-400 text-sm font-bold uppercase tracking-wider">
                Pos
              </div>
              <div className="text-white text-3xl font-mono font-bold">
                {playerPosition || "-"}
                <span className="text-gray-400 text-lg">/{racerCount}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-black/60 backdrop-blur-sm rounded-xl p-3 border-2 border-blue-400">
          <div className="text-blue-400 text-sm font-bold uppercase tracking-wider">
            Time
          </div>
          <div className="text-white text-3xl font-mono font-bold">
            {formatTime(totalRaceTime)}
          </div>
          <div className="text-gray-400 text-xs font-mono mt-1">
            Lap {formatTime(currentLapTime)}
          </div>
        </div>

        {bestLapTime && (
          <div className="bg-black/60 backdrop-blur-sm rounded-xl p-3 border-2 border-green-400">
            <div className="text-green-400 text-sm font-bold uppercase tracking-wider">
              Best
            </div>
            <div className="text-white text-2xl font-mono font-bold">
              {formatTime(bestLapTime)}
            </div>
          </div>
        )}
      </div>

      <div className="absolute top-28 right-4 z-40 pointer-events-none">
        <Minimap />
      </div>

      {wrongWay && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="text-4xl md:text-6xl font-black text-red-500 animate-pulse whitespace-nowrap [text-shadow:0_0_30px_#ef4444]">
            ⚠ WRONG WAY
          </div>
        </div>
      )}

      {lapToast && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none text-center">
          <div className="bg-black/70 backdrop-blur-sm rounded-xl px-6 py-3 border-2 border-yellow-400 inline-block">
            <div className="text-white text-xl font-bold whitespace-nowrap">
              Lap {lapToast.lapNo} ·{" "}
              <span className="font-mono text-yellow-300">
                {formatTime(lapToast.time)}
              </span>
            </div>
            {lapToast.isBest && (
              <div className="text-green-400 font-black text-sm mt-1 animate-pulse">
                NEW BEST LAP!
              </div>
            )}
          </div>
          {lapToast.isFinal && (
            <div className="mt-3 text-4xl md:text-6xl font-black text-yellow-400 animate-pulse whitespace-nowrap [text-shadow:0_0_30px_#facc15]">
              FINAL LAP
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-between items-end z-40 pointer-events-none">
        <div className="bg-black/60 backdrop-blur-sm rounded-xl p-4 border-2 border-red-400">
          <div className="flex items-end gap-2">
            <div className="text-white text-5xl font-mono font-bold">
              {Math.round(speed)}
            </div>
            <div className="text-gray-400 text-sm mb-2">km/h</div>
          </div>
          <div className="w-32 h-2 bg-gray-700 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-100"
              style={{ width: `${Math.min(100, (speed / maxSpeed) * 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-black/60 backdrop-blur-sm rounded-xl p-4 border-2 border-purple-400">
          <div className="text-purple-400 text-sm font-bold uppercase tracking-wider mb-1">
            Boost
          </div>
          <div className="w-32 h-4 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-100"
              style={{ width: `${boostAmount}%` }}
            />
          </div>
          <div className="text-white text-xs mt-1 text-center">
            Hold <span className="bg-gray-700 px-1 rounded">SHIFT</span> to use
          </div>
        </div>

        <div className="bg-black/60 backdrop-blur-sm rounded-xl p-4 border-2 border-yellow-400">
          <div className="text-yellow-400 text-sm font-bold uppercase tracking-wider mb-1">
            Item <span className="text-xs text-gray-400 font-normal normal-case">[E]</span>
          </div>
          {hasItem && currentItem ? (
            <div className="w-16 h-16 bg-yellow-400 rounded-lg flex flex-col items-center justify-center">
              <span className="text-2xl">{ITEM_INFO[currentItem].emoji}</span>
              <span className="text-[9px] font-bold text-black leading-tight">
                {ITEM_INFO[currentItem].name}
              </span>
            </div>
          ) : (
            <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-500">
              <span className="text-gray-500 text-xs">Empty</span>
            </div>
          )}
          {activeEffect && (
            <div className="mt-2 text-center">
              <div className="text-xs text-green-400 font-bold animate-pulse">
                {ITEM_INFO[activeEffect.type].emoji} {ITEM_INFO[activeEffect.type].name}
              </div>
              <div className="text-[10px] text-gray-300">
                {activeEffect.remaining.toFixed(1)}s
              </div>
            </div>
          )}
        </div>
      </div>

      {showControls && (
        <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 bg-black/70 backdrop-blur-sm rounded-xl p-4 text-center z-40 transition-opacity duration-500">
          <div className="flex gap-6 text-white text-sm">
            <div className="flex items-center gap-2">
              <span className="bg-gray-700 px-2 py-1 rounded">WASD</span>
              <span>Drive</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-gray-700 px-2 py-1 rounded">SPACE</span>
              <span>Brake</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-gray-700 px-2 py-1 rounded">SHIFT</span>
              <span>Boost</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-gray-700 px-2 py-1 rounded">E</span>
              <span>Item</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-gray-700 px-2 py-1 rounded">R</span>
              <span>Respawn</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-gray-700 px-2 py-1 rounded">ESC</span>
              <span>Pause</span>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={pauseGame}
        className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full z-50 transition-all"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
    </>
  );
}
