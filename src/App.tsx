import { useEffect, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Stars } from "@react-three/drei";
import { Track } from "./components/Track";
import { getTrackLayout, getTrackStart } from "./components/trackData";
import { Car } from "./components/Car";
import { CameraController } from "./components/CameraController";
import { Environment } from "./components/Environment";
import { GameUI } from "./components/GameUI";
import { MobileController } from "./components/MobileController";
import { useGameStore } from "./store/gameStore";
import "./App.css";

function GameScene() {
  const { isPlaying, isPaused, updateLapTime, selectedTrackId } = useGameStore();
  const trackLayout = getTrackLayout(selectedTrackId);
  const playerStart = getTrackStart(selectedTrackId);
  const isNeon = trackLayout.definition.theme === "neon";
  const isDesert = trackLayout.definition.theme === "desert";

  // Update lap time
  useEffect(() => {
    if (!isPlaying || isPaused) return;

    const interval = setInterval(() => {
      updateLapTime(0.1);
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, isPaused, updateLapTime]);

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

        {/* Environment */}
        <Environment trackId={selectedTrackId} />
      </Physics>

      {/* Camera */}
      <CameraController />
    </>
  );
}

function App() {
  const { isPlaying, isPaused, pauseGame, resumeGame } = useGameStore();

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
