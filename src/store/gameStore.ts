import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { getTrackStart } from '../components/Track';

const trackStart = getTrackStart();

export interface GameState {
  // Game status
  isPlaying: boolean;
  isPaused: boolean;
  gameOver: boolean;
  
  // Race stats
  lap: number;
  totalLaps: number;
  lapTimes: number[];
  currentLapTime: number;
  bestLapTime: number | null;
  
  // Car stats
  speed: number;
  maxSpeed: number;
  boostAmount: number;
  hasItem: boolean;
  currentItem: string | null;
  
  // Position
  carPosition: [number, number, number];
  carRotation: [number, number, number];
  
  // Actions
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  endGame: () => void;
  resetGame: () => void;
  
  // Lap actions
  completeLap: () => void;
  updateLapTime: (delta: number) => void;
  
  // Car actions
  updateSpeed: (speed: number) => void;
  updateBoost: (amount: number) => void;
  useItem: () => void;
  collectItem: (item: string) => void;
  updateCarPosition: (position: [number, number, number]) => void;
  updateCarRotation: (rotation: [number, number, number]) => void;
}

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isPlaying: false,
    isPaused: false,
    gameOver: false,
    
    lap: 1,
    totalLaps: 3,
    lapTimes: [],
    currentLapTime: 0,
    bestLapTime: null,
    
    speed: 0,
    maxSpeed: 80,
    boostAmount: 100,
    hasItem: false,
    currentItem: null,
    
    carPosition: trackStart.position,
    carRotation: [0, trackStart.yaw, 0],
    
    // Game flow actions
    startGame: () => set({ 
      isPlaying: true, 
      isPaused: false, 
      gameOver: false,
      lap: 1,
      lapTimes: [],
      currentLapTime: 0,
      speed: 0,
      boostAmount: 100,
      hasItem: false,
      currentItem: null,
      carPosition: trackStart.position,
      carRotation: [0, trackStart.yaw, 0]
    }),
    
    pauseGame: () => set({ isPaused: true }),
    resumeGame: () => set({ isPaused: false }),
    endGame: () => set({ isPlaying: false, gameOver: true }),
    
    resetGame: () => set({
      isPlaying: false,
      isPaused: false,
      gameOver: false,
      lap: 1,
      lapTimes: [],
      currentLapTime: 0,
      bestLapTime: null,
      speed: 0,
      boostAmount: 100,
      hasItem: false,
      currentItem: null,
      carPosition: trackStart.position,
      carRotation: [0, trackStart.yaw, 0]
    }),
    
    // Lap actions
    completeLap: () => {
      const state = get();
      const newLapTimes = [...state.lapTimes, state.currentLapTime];
      const newBestLap = state.bestLapTime 
        ? Math.min(state.bestLapTime, state.currentLapTime)
        : state.currentLapTime;
      
      if (state.lap >= state.totalLaps) {
        set({ gameOver: true, isPlaying: false });
      } else {
        set({
          lap: state.lap + 1,
          lapTimes: newLapTimes,
          currentLapTime: 0,
          bestLapTime: newBestLap
        });
      }
    },
    
    updateLapTime: (delta) => {
      const state = get();
      if (state.isPlaying && !state.isPaused) {
        set({ currentLapTime: state.currentLapTime + delta });
      }
    },
    
    // Car actions
    updateSpeed: (speed) => set({ speed: Math.max(0, Math.min(speed, get().maxSpeed)) }),
    
    updateBoost: (amount) => set({ boostAmount: Math.max(0, Math.min(100, amount)) }),
    
    collectItem: (item) => set({ hasItem: true, currentItem: item }),
    
    useItem: () => {
      const state = get();
      if (state.hasItem && state.currentItem) {
        // Apply item effect based on type
        set({ hasItem: false, currentItem: null });
      }
    },
    
    updateCarPosition: (position) => set({ carPosition: position }),
    updateCarRotation: (rotation) => set({ carRotation: rotation })
  }))
);
