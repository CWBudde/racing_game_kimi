import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { DEFAULT_TRACK_ID, getTrackStart, TRACKS } from "../components/trackData";

const HIGHSCORE_STORAGE_KEY = "kart-racing-highscores";
const initialTrack = TRACKS.find((track) => track.id === DEFAULT_TRACK_ID) ?? TRACKS[0];
const initialTrackId = initialTrack?.id ?? DEFAULT_TRACK_ID;
const initialTrackStart = getTrackStart(initialTrackId);

export interface HighScoreEntry {
  id: string;
  totalTime: number;
  bestLapTime: number;
  achievedAt: string;
}

const loadHighScores = (): HighScoreEntry[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(HIGHSCORE_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (entry): entry is HighScoreEntry =>
          !!entry &&
          typeof entry.id === "string" &&
          typeof entry.totalTime === "number" &&
          typeof entry.bestLapTime === "number" &&
          typeof entry.achievedAt === "string",
      )
      .sort((a, b) => a.totalTime - b.totalTime)
      .slice(0, 5);
  } catch {
    return [];
  }
};

const saveHighScores = (entries: HighScoreEntry[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HIGHSCORE_STORAGE_KEY, JSON.stringify(entries));
};

export type ItemType =
  | "boost-refill"
  | "speed-star"
  | "time-bonus"
  | "grip-boost"
  | "turbo";

export interface ActiveEffect {
  type: ItemType;
  remaining: number;
}

export const ITEM_POOLS: Record<string, ItemType[]> = {
  "coastal-gp": ["boost-refill", "speed-star", "time-bonus"],
  "desert-run": ["turbo", "grip-boost", "time-bonus"],
  "neon-district": ["turbo", "speed-star", "boost-refill", "time-bonus"],
};

export const ITEM_INFO: Record<
  ItemType,
  { name: string; emoji: string; duration: number }
> = {
  "boost-refill": { name: "Boost Refill", emoji: "⚡", duration: 0 },
  "speed-star": { name: "Speed Star", emoji: "⭐", duration: 5 },
  "time-bonus": { name: "Time Bonus", emoji: "⏱️", duration: 0 },
  "grip-boost": { name: "Grip Boost", emoji: "🧲", duration: 5 },
  turbo: { name: "Turbo", emoji: "🔥", duration: 0 },
};

export interface GameState {
  // Game status
  showMainMenu: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  gameOver: boolean;
  isCountingDown: boolean;
  selectedTrackId: string;

  // Race stats
  lap: number;
  totalLaps: number;
  lapTimes: number[];
  currentLapTime: number;
  totalRaceTime: number;
  bestLapTime: number | null;
  highScores: HighScoreEntry[];
  lastRaceRank: number | null;

  // Car stats
  speed: number;
  maxSpeed: number;
  boostAmount: number;
  hasItem: boolean;
  currentItem: ItemType | null;
  activeEffect: ActiveEffect | null;

  // Position
  carPosition: [number, number, number];
  carRotation: [number, number, number];

  // Actions
  openMainMenu: () => void;
  openRaceSetup: () => void;
  selectTrack: (trackId: string) => void;
  beginCountdown: () => void;
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
  collectItem: (item: ItemType) => void;
  updateActiveEffect: (delta: number) => void;
  updateCarPosition: (position: [number, number, number]) => void;
  updateCarRotation: (rotation: [number, number, number]) => void;
}

const resetRaceState = (trackId: string) => {
  const track = TRACKS.find((entry) => entry.id === trackId);
  const trackStart = getTrackStart(trackId);

  return {
    lap: 1,
    totalLaps: track?.laps ?? 3,
    lapTimes: [],
    currentLapTime: 0,
    totalRaceTime: 0,
    bestLapTime: null,
    lastRaceRank: null,
    speed: 0,
    boostAmount: 100,
    hasItem: false,
    currentItem: null,
    activeEffect: null,
    carPosition: trackStart.position,
    carRotation: [0, trackStart.yaw, 0] as [number, number, number],
  };
};

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    showMainMenu: true,
    isPlaying: false,
    isPaused: false,
    gameOver: false,
    isCountingDown: false,
    selectedTrackId: initialTrackId,

    lap: 1,
    totalLaps: initialTrack?.laps ?? 3,
    lapTimes: [],
    currentLapTime: 0,
    totalRaceTime: 0,
    bestLapTime: null,
    highScores: loadHighScores(),
    lastRaceRank: null,

    speed: 0,
    maxSpeed: 80,
    boostAmount: 100,
    hasItem: false,
    currentItem: null,
    activeEffect: null,

    carPosition: initialTrackStart.position,
    carRotation: [0, initialTrackStart.yaw, 0],

    openMainMenu: () =>
      set((state) => ({
        showMainMenu: true,
        isPlaying: false,
        isPaused: false,
        gameOver: false,
        isCountingDown: false,
        ...resetRaceState(state.selectedTrackId),
      })),

    openRaceSetup: () =>
      set((state) => ({
        showMainMenu: false,
        isPlaying: false,
        isPaused: false,
        gameOver: false,
        isCountingDown: false,
        ...resetRaceState(state.selectedTrackId),
      })),

    selectTrack: (trackId) => {
      const track = TRACKS.find((entry) => entry.id === trackId);
      if (!track) return;

      set({
        selectedTrackId: trackId,
        ...resetRaceState(trackId),
      });
    },

    beginCountdown: () =>
      set((state) => ({
        showMainMenu: false,
        isCountingDown: true,
        isPlaying: false,
        isPaused: false,
        gameOver: false,
        ...resetRaceState(state.selectedTrackId),
      })),

    startGame: () =>
      set((state) => ({
        showMainMenu: false,
        isPlaying: true,
        isCountingDown: false,
        isPaused: false,
        gameOver: false,
        ...resetRaceState(state.selectedTrackId),
      })),

    pauseGame: () => set({ isPaused: true }),
    resumeGame: () => set({ isPaused: false }),
    endGame: () => set({ isPlaying: false, gameOver: true }),
    resetGame: () =>
      set((state) => ({
        showMainMenu: true,
        isPlaying: false,
        isPaused: false,
        gameOver: false,
        isCountingDown: false,
        ...resetRaceState(state.selectedTrackId),
      })),

    completeLap: () => {
      const state = get();
      const newLapTimes = [...state.lapTimes, state.currentLapTime];
      const newBestLap = state.bestLapTime
        ? Math.min(state.bestLapTime, state.currentLapTime)
        : state.currentLapTime;

      if (state.lap >= state.totalLaps) {
        const entry: HighScoreEntry = {
          id: `${Date.now()}`,
          totalTime: state.totalRaceTime,
          bestLapTime: newBestLap,
          achievedAt: new Date().toISOString(),
        };
        const highScores = [...state.highScores, entry]
          .sort((a, b) => a.totalTime - b.totalTime)
          .slice(0, 5);
        saveHighScores(highScores);

        set({
          gameOver: true,
          isPlaying: false,
          lapTimes: newLapTimes,
          bestLapTime: newBestLap,
          highScores,
          lastRaceRank:
            highScores.findIndex((score) => score.id === entry.id) + 1 || null,
        });
      } else {
        set({
          lap: state.lap + 1,
          lapTimes: newLapTimes,
          currentLapTime: 0,
          bestLapTime: newBestLap,
        });
      }
    },

    updateLapTime: (delta) => {
      const state = get();
      if (state.isPlaying && !state.isPaused) {
        set({
          currentLapTime: state.currentLapTime + delta,
          totalRaceTime: state.totalRaceTime + delta,
        });
      }
    },

    updateSpeed: (speed) =>
      set({ speed: Math.max(0, Math.min(speed, get().maxSpeed)) }),

    updateBoost: (amount) =>
      set({ boostAmount: Math.max(0, Math.min(100, amount)) }),

    collectItem: (item) => set({ hasItem: true, currentItem: item }),

    useItem: () => {
      const state = get();
      if (!state.hasItem || !state.currentItem) return;

      const item = state.currentItem;
      const info = ITEM_INFO[item];

      switch (item) {
        case "boost-refill":
          set({ boostAmount: 100, hasItem: false, currentItem: null });
          break;
        case "time-bonus":
          set({
            currentLapTime: Math.max(0, state.currentLapTime - 2),
            totalRaceTime: Math.max(0, state.totalRaceTime - 2),
            hasItem: false,
            currentItem: null,
          });
          break;
        case "turbo":
          set({
            activeEffect: { type: "turbo", remaining: 0.8 },
            hasItem: false,
            currentItem: null,
          });
          break;
        case "speed-star":
        case "grip-boost":
          set({
            activeEffect: { type: item, remaining: info.duration },
            hasItem: false,
            currentItem: null,
          });
          break;
      }
    },

    updateActiveEffect: (delta) => {
      const state = get();
      if (!state.activeEffect) return;
      const remaining = state.activeEffect.remaining - delta;
      if (remaining <= 0) {
        set({ activeEffect: null });
      } else {
        set({ activeEffect: { ...state.activeEffect, remaining } });
      }
    },

    updateCarPosition: (position) => set({ carPosition: position }),
    updateCarRotation: (rotation) => set({ carRotation: rotation }),
  })),
);
