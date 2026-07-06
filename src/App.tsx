import { useEffect, useCallback } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Stars } from "@react-three/drei";
import { Track } from "./components/Track";
import { getTrackLayout, getTrackStart } from "./components/trackData";
import { Car } from "./components/Car";
import { CameraController } from "./components/CameraController";
import { Environment } from "./components/Environment";
import { AIOpponent } from "./components/AIOpponent";
import { GameUI } from "./components/GameUI";
import { MobileController } from "./components/MobileController";
import { useGameStore } from "./store/gameStore";
import "./App.css";

function GameScene() {
  // Selector reads only — subscribing to the whole store would re-render the
  // entire 3D scene on every per-frame timer tick.
  const updateLapTime = useGameStore((state) => state.updateLapTime);
  const selectedTrackId = useGameStore((state) => state.selectedTrackId);
  const trackLayout = getTrackLayout(selectedTrackId);
  const playerStart = getTrackStart(selectedTrackId);
  const isNeon = trackLayout.definition.theme === "neon";
  const isDesert = trackLayout.definition.theme === "desert";

  // Drive the race/lap timer from the render clock — the same one the physics
  // uses — instead of a setInterval, which is throttled in background tabs and
  // never fires at exactly 100 ms, so the centisecond HUD drifts. Flush every
  // frame (updateLapTime self-guards on play/pause) so currentLapTime is always
  // current when a lap/finish gate calls completeLap; batching would leave up to
  // one tick unrecorded and under-report the split. The store is already written
  // per frame by the physics, so this adds no meaningful cost. Pathological gaps
  // (a backgrounded tab, where nothing simulates) are capped so they aren't
  // counted as race time.
  useFrame((_, delta) => {
    updateLapTime(Math.min(delta, 0.1));
  });

  return (
    <>
      <color
        attach="background"
        args={[isNeon ? "#040712" : isDesert ? "#d9a66c" : "#87CEEB"]}
      />
      <fog
        attach="fog"
        args={[
          isNeon ? "#040712" : isDesert ? "#d9a66c" : "#87CEEB",
          isNeon ? 90 : 100,
          isNeon ? 700 : 800,
        ]}
      />

      {/* Stars (visible at edges) */}
      <Stars
        radius={isNeon ? 260 : 200}
        depth={isNeon ? 120 : 50}
        count={isNeon ? 1400 : 1000}
        factor={isNeon ? 5 : 4}
        saturation={isNeon ? 0.2 : 0}
        fade
        speed={isNeon ? 0.6 : 1}
      />

      {/* Physics World */}
      <Physics gravity={[0, -10, 0]}>
        {/* Track */}
        <Track trackId={selectedTrackId} />

        {/* Player Car - spawn on track at start/finish line */}
        <Car key={`player-${selectedTrackId}`} position={playerStart.position} />

        {/* AI Opponents */}
        <AIOpponent
          key={`ai-2-${selectedTrackId}`}
          color="#2563eb"
          carNumber={2}
          startT={0.97}
          speedT={0.048}
        />
        <AIOpponent
          key={`ai-3-${selectedTrackId}`}
          color="#16a34a"
          carNumber={3}
          startT={0.94}
          speedT={0.042}
        />

        {/* Environment */}
        <Environment trackId={selectedTrackId} />
      </Physics>

      {/* Camera */}
      <CameraController />
    </>
  );
}

function App() {
  const isPlaying = useGameStore((state) => state.isPlaying);
  const isPaused = useGameStore((state) => state.isPaused);
  const pauseGame = useGameStore((state) => state.pauseGame);
  const resumeGame = useGameStore((state) => state.resumeGame);

  // Handle ESC key for pause
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isPlaying && !isPaused) {
          pauseGame();
        } else if (isPlaying && isPaused) {
          resumeGame();
        }
      }
    },
    [isPlaying, isPaused, pauseGame, resumeGame],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 10, -20], fov: 60 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <GameScene />
      </Canvas>

      {/* UI Overlay */}
      <GameUI />
      <MobileController />
    </div>
  );
}

export default App;
