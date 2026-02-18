import { useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Stars } from '@react-three/drei';
import { Track } from './components/Track';
import { Car } from './components/Car';
import { CameraController } from './components/CameraController';
import { Environment } from './components/Environment';
import { GameUI } from './components/GameUI';
import { useGameStore } from './store/gameStore';
import './App.css';

function GameScene() {
  const { isPlaying, isPaused, updateLapTime } = useGameStore();
  
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
      <color attach="background" args={['#87CEEB']} />
      <fog attach="fog" args={['#87CEEB', 50, 300]} />
      
      {/* Stars (visible at edges) */}
      <Stars radius={200} depth={50} count={1000} factor={4} saturation={0} fade speed={1} />
      
      {/* Physics World */}
      <Physics gravity={[0, -20, 0]}>
        {/* Track */}
        <Track />
        
        {/* Player Car */}
        <Car position={[0, 2, 0]} />
        
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
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (isPlaying && !isPaused) {
        pauseGame();
      } else if (isPlaying && isPaused) {
        resumeGame();
      }
    }
  }, [isPlaying, isPaused, pauseGame, resumeGame]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
    </div>
  );
}

export default App;
