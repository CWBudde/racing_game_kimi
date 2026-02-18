import { useEffect, useState, useRef } from 'react';
import { useGameStore } from '../store/gameStore';

// Format time as MM:SS.ms
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export function GameUI() {
  const {
    isPlaying,
    isPaused,
    gameOver,
    lap,
    totalLaps,
    currentLapTime,
    bestLapTime,
    speed,
    boostAmount,
    hasItem,
    startGame,
    pauseGame,
    resumeGame,
    resetGame
  } = useGameStore();
  
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
  
  // Start screen
  if (!isPlaying && !gameOver) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50">
        <div className="bg-gradient-to-br from-blue-900 to-purple-900 p-8 rounded-2xl shadow-2xl text-center max-w-md border-4 border-yellow-400">
          <h1 className="text-5xl font-bold text-white mb-2 drop-shadow-lg">
            <span className="text-yellow-400">KART</span> RACING
          </h1>
          <p className="text-gray-300 mb-6">3D Racing Adventure</p>
          
          <div className="bg-black/30 p-4 rounded-lg mb-6 text-left">
            <h3 className="text-yellow-400 font-bold mb-2">Controls:</h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-white">
              <div><span className="bg-gray-700 px-2 py-1 rounded">W</span> / <span className="bg-gray-700 px-2 py-1 rounded">↑</span> Accelerate</div>
              <div><span className="bg-gray-700 px-2 py-1 rounded">S</span> / <span className="bg-gray-700 px-2 py-1 rounded">↓</span> Brake/Reverse</div>
              <div><span className="bg-gray-700 px-2 py-1 rounded">A</span> / <span className="bg-gray-700 px-2 py-1 rounded">←</span> Turn Left</div>
              <div><span className="bg-gray-700 px-2 py-1 rounded">D</span> / <span className="bg-gray-700 px-2 py-1 rounded">→</span> Turn Right</div>
              <div><span className="bg-gray-700 px-2 py-1 rounded">SPACE</span> Handbrake</div>
              <div><span className="bg-gray-700 px-2 py-1 rounded">SHIFT</span> Boost</div>
            </div>
          </div>
          
          <button
            onClick={startGame}
            className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-12 rounded-full text-xl transition-all transform hover:scale-105 shadow-lg"
          >
            START RACE
          </button>
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
              Total Time: <span className="text-yellow-400 font-mono">{formatTime(currentLapTime)}</span>
            </div>
            {bestLapTime && (
              <div className="text-lg text-gray-300">
                Best Lap: <span className="text-green-400 font-mono">{formatTime(bestLapTime)}</span>
              </div>
            )}
          </div>
          
          <div className="flex gap-4 justify-center">
            <button
              onClick={resetGame}
              className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-bold py-3 px-8 rounded-full transition-all"
            >
              Main Menu
            </button>
            <button
              onClick={startGame}
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
              onClick={resetGame}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3 px-8 rounded-full transition-all"
            >
              Quit
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Main HUD
  return (
    <>
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-40 pointer-events-none">
        {/* Lap Counter */}
        <div className="bg-black/60 backdrop-blur-sm rounded-xl p-3 border-2 border-yellow-400">
          <div className="text-yellow-400 text-sm font-bold uppercase tracking-wider">Lap</div>
          <div className="text-white text-3xl font-mono font-bold">
            {lap}<span className="text-gray-400 text-lg">/{totalLaps}</span>
          </div>
        </div>
        
        {/* Timer */}
        <div className="bg-black/60 backdrop-blur-sm rounded-xl p-3 border-2 border-blue-400">
          <div className="text-blue-400 text-sm font-bold uppercase tracking-wider">Time</div>
          <div className="text-white text-3xl font-mono font-bold">
            {formatTime(currentLapTime)}
          </div>
        </div>
        
        {/* Best Lap */}
        {bestLapTime && (
          <div className="bg-black/60 backdrop-blur-sm rounded-xl p-3 border-2 border-green-400">
            <div className="text-green-400 text-sm font-bold uppercase tracking-wider">Best</div>
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
          <div className="text-purple-400 text-sm font-bold uppercase tracking-wider mb-1">Boost</div>
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
          <div className="text-yellow-400 text-sm font-bold uppercase tracking-wider mb-1">Item</div>
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
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
    </>
  );
}
