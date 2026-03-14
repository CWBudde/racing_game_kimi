import { useEffect, useState, useRef } from "react";
import { TRACKS } from "./trackData";
import { useGameStore } from "../store/gameStore";

// ── Traffic-light countdown overlay ──────────────────────────────────────────
// phases: 0 = "3" red | 1 = "2" red+yellow | 2 = "1" yellow | 3 = "GO" green
function CountdownOverlay() {
  const startGame = useGameStore((s) => s.startGame);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timings = [1000, 1000, 1000, 700]; // ms per phase
    let current = 0;

    const tick = () => {
      current++;
      if (current < 4) {
        setPhase(current);
        setTimeout(tick, timings[current]);
      } else {
        startGame();
      }
    };

    const id = setTimeout(tick, timings[0]);
    return () => clearTimeout(id);
  }, [startGame]);

  const redOn    = phase === 0 || phase === 1;
  const yellowOn = phase === 1 || phase === 2;
  const greenOn  = phase === 3;

  const label   = phase === 3 ? "GO!" : String(3 - phase);
  const labelColor = phase === 3 ? "#22c55e" : phase === 2 ? "#eab308" : "#ef4444";

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="flex flex-col items-center gap-6">
        {/* Traffic light housing */}
        <div className="bg-gray-900 border-4 border-gray-700 rounded-2xl p-5 flex flex-col gap-4 shadow-2xl">
          {/* Red */}
          <div
            className="w-20 h-20 rounded-full border-4 border-gray-700 transition-all duration-150"
            style={{
              background: redOn ? "#ef4444" : "#3f0a0a",
              boxShadow: redOn ? "0 0 32px 8px #ef444488" : "none",
            }}
          />
          {/* Yellow */}
          <div
            className="w-20 h-20 rounded-full border-4 border-gray-700 transition-all duration-150"
            style={{
              background: yellowOn ? "#eab308" : "#3b2a00",
              boxShadow: yellowOn ? "0 0 32px 8px #eab30888" : "none",
            }}
          />
          {/* Green */}
          <div
            className="w-20 h-20 rounded-full border-4 border-gray-700 transition-all duration-150"
            style={{
              background: greenOn ? "#22c55e" : "#052010",
              boxShadow: greenOn ? "0 0 32px 8px #22c55e88" : "none",
            }}
          />
        </div>

        {/* Big number / GO */}
        <div
          className="text-8xl font-black drop-shadow-lg transition-all duration-150"
          style={{ color: labelColor, textShadow: `0 0 40px ${labelColor}` }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

// Format time as MM:SS.ms
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
};

function HighScorePanel() {
  const { highScores, lastRaceRank } = useGameStore();

  return (
    <div className="bg-black/30 p-4 rounded-lg text-left">
      <div className="flex items-center justify-between gap-4 mb-3">
        <h3 className="text-yellow-400 font-bold">Top 5</h3>
        {lastRaceRank && (
          <span className="text-xs text-green-300">Latest finish: #{lastRaceRank}</span>
        )}
      </div>

      {highScores.length === 0 ? (
        <div className="text-sm text-gray-300">No recorded runs yet.</div>
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
    currentLapTime,
    totalRaceTime,
    bestLapTime,
    lastRaceRank,
    selectedCourseId,
    speed,
    boostAmount,
    hasItem,
    openMainMenu,
    openRaceSetup,
    selectCourse,
    beginCountdown,
    pauseGame,
    resumeGame,
  } = useGameStore();
  const selectedCourse = TRACKS.find((track) => track.id === selectedCourseId) ?? TRACKS[0];

  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide controls after 5 seconds
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

  // Show controls when game starts
  useEffect(() => {
    if (isPlaying) {
      setShowControls(true);
    }
  }, [isPlaying]);

  if (showMainMenu) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50">
        <div className="w-full max-w-5xl mx-4 bg-gradient-to-br from-slate-900 via-blue-950 to-cyan-950 rounded-[2rem] border-4 border-cyan-400/70 shadow-2xl overflow-hidden">
          <div className="grid md:grid-cols-[1.1fr_0.9fr]">
            <div className="p-8 md:p-10 border-b md:border-b-0 md:border-r border-white/10">
              <div className="text-cyan-300 text-sm tracking-[0.35em] uppercase mb-3">
                Main Menu
              </div>
              <h1 className="text-5xl md:text-6xl font-black text-white leading-none mb-4">
                KART
                <span className="block text-cyan-300">RACING</span>
              </h1>
              <p className="text-slate-200 max-w-xl mb-8">
                Pick a course, review the leaderboard, then continue to the race setup screen.
              </p>

              <div className="space-y-4">
                {TRACKS.map((track) => {
                  const isSelected = track.id === selectedCourseId;

                  return (
                    <button
                      key={track.id}
                      onClick={() => selectCourse(track.id)}
                      className={`w-full rounded-2xl border p-5 text-left transition-all ${
                        isSelected
                          ? "border-cyan-300 bg-cyan-400/15 shadow-[0_0_0_1px_rgba(103,232,249,0.35)]"
                          : "border-white/10 bg-white/5 hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-2xl font-bold text-white">{track.name}</div>
                          <div className="text-sm text-cyan-200 mt-1">{track.location}</div>
                        </div>
                        <div className="text-right text-xs uppercase tracking-wide text-slate-300">
                          <div>{track.difficulty}</div>
                          <div>{track.laps} laps</div>
                        </div>
                      </div>
                      <div className="text-sm text-slate-200 mt-3">{track.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-8 md:p-10 bg-black/20">
              <div className="rounded-2xl border border-cyan-300/30 bg-black/25 p-5 mb-6">
                <div className="text-xs uppercase tracking-[0.3em] text-cyan-200 mb-2">
                  Selected Course
                </div>
                <div className="text-3xl font-bold text-white">{selectedCourse.name}</div>
                <div className="text-slate-300 mt-2">
                  {selectedCourse.location} · {selectedCourse.difficulty} · {selectedCourse.laps} laps
                </div>
              </div>

              <div className="mb-6">
                <HighScorePanel />
              </div>

              <button
                onClick={openRaceSetup}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black py-4 px-8 rounded-full text-lg transition-all"
              >
                Continue To Race Setup
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Start screen (also shown while counting down so the 3D scene is visible behind)
  if (!isPlaying && !isCountingDown && !gameOver) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50">
        <div className="bg-gradient-to-br from-blue-900 to-purple-900 p-8 rounded-2xl shadow-2xl text-center max-w-md border-4 border-yellow-400">
          <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">
            <span className="text-yellow-400">KART</span> RACING
          </h1>
          <p className="text-gray-300 mb-2">3D Racing Adventure</p>
          <div className="text-sm text-cyan-200 mb-6">
            Course: <span className="font-bold text-white">{selectedCourse.name}</span> · {selectedCourse.laps} laps
          </div>

          <div className="bg-black/30 p-4 rounded-lg mb-6 text-left">
            <h3 className="text-yellow-400 font-bold mb-2">Controls:</h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-white">
              <div>
                <span className="bg-gray-700 px-2 py-1 rounded">W</span> /{" "}
                <span className="bg-gray-700 px-2 py-1 rounded">↑</span>{" "}
                Accelerate
              </div>
              <div>
                <span className="bg-gray-700 px-2 py-1 rounded">S</span> /{" "}
                <span className="bg-gray-700 px-2 py-1 rounded">↓</span>{" "}
                Brake/Reverse
              </div>
              <div>
                <span className="bg-gray-700 px-2 py-1 rounded">A</span> /{" "}
                <span className="bg-gray-700 px-2 py-1 rounded">←</span> Turn
                Left
              </div>
              <div>
                <span className="bg-gray-700 px-2 py-1 rounded">D</span> /{" "}
                <span className="bg-gray-700 px-2 py-1 rounded">→</span> Turn
                Right
              </div>
              <div>
                <span className="bg-gray-700 px-2 py-1 rounded">SPACE</span>{" "}
                Handbrake
              </div>
              <div>
                <span className="bg-gray-700 px-2 py-1 rounded">SHIFT</span>{" "}
                Boost
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-200">
              Xbox controller: left stick or D-pad steer, RT accelerate, LT
              brake/reverse, A handbrake, RB boost
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
              className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-12 rounded-full text-xl transition-all transform hover:scale-105 shadow-lg"
            >
              START RACE
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Game Over screen
  if (gameOver) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
        <div className="bg-gradient-to-br from-purple-900 to-blue-900 p-8 rounded-2xl shadow-2xl text-center max-w-md border-4 border-yellow-400">
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

  // Pause screen
  if (isPaused) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
        <div className="bg-gradient-to-br from-blue-900 to-purple-900 p-8 rounded-2xl shadow-2xl text-center border-4 border-white">
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

  // Countdown screen — no menus, just the traffic light over the 3D world
  if (isCountingDown) {
    return <CountdownOverlay />;
  }

  // Main HUD
  return (
    <>
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-40 pointer-events-none">
        {/* Lap Counter */}
        <div className="bg-black/60 backdrop-blur-sm rounded-xl p-3 border-2 border-yellow-400">
          <div className="text-yellow-400 text-sm font-bold uppercase tracking-wider">
            Lap
          </div>
          <div className="text-white text-3xl font-mono font-bold">
            {lap}
            <span className="text-gray-400 text-lg">/{totalLaps}</span>
          </div>
        </div>

        {/* Timer */}
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

        {/* Best Lap */}
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

      {/* Bottom Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-between items-end z-40 pointer-events-none">
        {/* Speedometer */}
        <div className="bg-black/60 backdrop-blur-sm rounded-xl p-4 border-2 border-red-400">
          <div className="flex items-end gap-2">
            <div className="text-white text-5xl font-mono font-bold">
              {Math.round(speed)}
            </div>
            <div className="text-gray-400 text-sm mb-2">km/h</div>
          </div>
          {/* Speed bar */}
          <div className="w-32 h-2 bg-gray-700 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-100"
              style={{ width: `${(speed / 100) * 100}%` }}
            />
          </div>
        </div>

        {/* Boost Meter */}
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

        {/* Item Box */}
        <div className="bg-black/60 backdrop-blur-sm rounded-xl p-4 border-2 border-yellow-400">
          <div className="text-yellow-400 text-sm font-bold uppercase tracking-wider mb-1">
            Item
          </div>
          {hasItem ? (
            <div className="w-16 h-16 bg-yellow-400 rounded-lg flex items-center justify-center">
              <span className="text-3xl">❓</span>
            </div>
          ) : (
            <div className="w-16 h-16 bg-gray-700 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-500">
              <span className="text-gray-500 text-xs">Empty</span>
            </div>
          )}
        </div>
      </div>

      {/* Controls Hint */}
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
              <span className="bg-gray-700 px-2 py-1 rounded">ESC</span>
              <span>Pause</span>
            </div>
          </div>
        </div>
      )}

      {/* Pause button */}
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
