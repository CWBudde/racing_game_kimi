import { useEffect, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Stars } from "@react-three/drei";
import { Track } from "./components/Track";
import { getTrackStart } from "./components/trackData";
import { Car } from "./components/Car";
import { CameraController } from "./components/CameraController";
import { Environment } from "./components/Environment";
import { AIOpponent } from "./components/AIOpponent";
import { GameUI } from "./components/GameUI";
import { MobileController } from "./components/MobileController";
import { useGameStore } from "./store/gameStore";
import "./App.css";

function GameScene() {
  const { isPlaying, isPaused, updateLapTime, selectedCourseId } = useGameStore();
  const playerStart = getTrackStart(selectedCourseId);

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
      {/* Sky */}
      <color attach="background" args={["#87CEEB"]} />
      <fog attach="fog" args={["#87CEEB", 100, 800]} />

      {/* Stars (visible at edges) */}
      <Stars
        radius={200}
        depth={50}
        count={1000}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />

      {/* Physics World */}
      <Physics gravity={[0, -10, 0]}>
        {/* Track */}
        <Track />

        {/* Player Car - spawn on track at start/finish line */}
        <Car key={`player-${selectedCourseId}`} position={playerStart.position} />

        {/* AI Opponents */}
        <AIOpponent
          key={`ai-2-${selectedCourseId}`}
          color="#2563eb"
          carNumber={2}
          startT={0.97}
          speedT={0.048}
        />
        <AIOpponent
          key={`ai-3-${selectedCourseId}`}
          color="#16a34a"
          carNumber={3}
          startT={0.94}
          speedT={0.042}
        />

        {/* Environment */}
        <Environment />
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
