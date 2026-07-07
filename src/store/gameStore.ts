import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { DEFAULT_TRACK_ID, TRACKS } from "../components/trackData";
import { TOP_SPEED_KMH } from "../components/carConstants";

const HIGHSCORE_STORAGE_KEY = "kart-racing-highscores";
const initialTrack = TRACKS.find((track) => track.id === DEFAULT_TRACK_ID) ?? TRACKS[0];
const initialTrackId = initialTrack?.id ?? DEFAULT_TRACK_ID;

export interface HighScoreEntry {
  id: string;
  trackId: string;
  totalTime: number;
  bestLapTime: number;
  achievedAt: string;
}

// High scores are keyed by track — different tracks have different lengths and
// lap counts, so a single combined board would bury slower-track times forever.
export type HighScoresByTrack = Record<string, HighScoreEntry[]>;

const MAX_SCORES_PER_TRACK = 5;

const isValidEntry = (entry: unknown): entry is Omit<HighScoreEntry, "trackId"> =>
  !!entry &&
  typeof (entry as HighScoreEntry).id === "string" &&
  typeof (entry as HighScoreEntry).totalTime === "number" &&
  typeof (entry as HighScoreEntry).bestLapTime === "number" &&
  typeof (entry as HighScoreEntry).achievedAt === "string";

const sortTrackScores = (entries: HighScoreEntry[]): HighScoreEntry[] =>
  [...entries]
    .sort((a, b) => a.totalTime - b.totalTime)
    .slice(0, MAX_SCORES_PER_TRACK);

const loadHighScores = (): HighScoresByTrack => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(HIGHSCORE_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);

    // Legacy format: a flat array with no track info. It can't be attributed to
    // a specific track, so migrate it under the default track id.
    if (Array.isArray(parsed)) {
      const migrated = parsed
        .filter(isValidEntry)
        .map((entry) => ({ ...entry, trackId: DEFAULT_TRACK_ID }));
      return migrated.length
        ? { [DEFAULT_TRACK_ID]: sortTrackScores(migrated) }
        : {};
    }

    if (!parsed || typeof parsed !== "object") return {};

    const byTrack: HighScoresByTrack = {};
    for (const [trackId, entries] of Object.entries(parsed)) {
      if (!Array.isArray(entries)) continue;
      const valid = entries
        .filter(isValidEntry)
        .map((entry) => ({ ...entry, trackId }));
      if (valid.length) byTrack[trackId] = sortTrackScores(valid);
    }
    return byTrack;
  } catch {
    return {};
  }
};

const saveHighScores = (byTrack: HighScoresByTrack) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HIGHSCORE_STORAGE_KEY, JSON.stringify(byTrack));
};

const getTrackScores = (
  byTrack: HighScoresByTrack,
  trackId: string,
): HighScoreEntry[] => byTrack[trackId] ?? [];

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

export type Difficulty = "easy" | "normal" | "hard";

// One finishing-order row for the post-race results table (player + AI).
export interface RaceResult {
  id: string;
  label: string;
  color: string;
  isPlayer: boolean;
  position: number;
  totalTime: number;
  gap: number; // seconds behind the winner (0 for P1)
}

export const ITEM_POOLS: Record<string, ItemType[]> = {
  "coastal-gp": ["boost-refill", "speed-star", "time-bonus"],
  "desert-run": ["turbo", "grip-boost", "time-bonus"],
  "neon-district": ["turbo", "speed-star", "boost-refill", "time-bonus"],
  "evergreen-trail": ["grip-boost", "boost-refill", "time-bonus"],
  "woodland-cross": ["turbo", "grip-boost", "speed-star", "time-bonus"],
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
  difficulty: Difficulty;

  // Race stats
  lap: number;
  totalLaps: number;
  lapTimes: number[];
  currentLapTime: number;
  totalRaceTime: number;
  bestLapTime: number | null;
  highScoresByTrack: HighScoresByTrack;
  highScores: HighScoreEntry[]; // board for the currently selected track
  lastRaceRank: number | null;

  // Live race vs AI
  playerPosition: number; // 1-based, 0 before a race starts
  racerCount: number; // total cars in the race (player + AI)
  raceResults: RaceResult[]; // finishing order, populated at race end

  // Car stats
  speed: number;
  maxSpeed: number;
  boostAmount: number;
  hasItem: boolean;
  currentItem: ItemType | null;
  activeEffect: ActiveEffect | null;

  // Actions
  openMainMenu: () => void;
  openRaceSetup: () => void;
  selectTrack: (trackId: string) => void;
  setDifficulty: (difficulty: Difficulty) => void;
  updateRacePosition: (position: number, count: number) => void;
  setRaceResults: (results: RaceResult[]) => void;
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
}

const resetRaceState = (trackId: string) => {
  const track = TRACKS.find((entry) => entry.id === trackId);

  return {
    lap: 1,
    totalLaps: track?.laps ?? 3,
    lapTimes: [],
    currentLapTime: 0,
    totalRaceTime: 0,
    bestLapTime: null,
    lastRaceRank: null,
    playerPosition: 0,
    racerCount: 0,
    raceResults: [],
    speed: 0,
    boostAmount: 100,
    hasItem: false,
    currentItem: null,
    activeEffect: null,
  };
};

const initialHighScores = loadHighScores();

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    showMainMenu: true,
    isPlaying: false,
    isPaused: false,
    gameOver: false,
    isCountingDown: false,
    selectedTrackId: initialTrackId,
    difficulty: "normal",

    lap: 1,
    totalLaps: initialTrack?.laps ?? 3,
    lapTimes: [],
    currentLapTime: 0,
    totalRaceTime: 0,
    bestLapTime: null,
    highScoresByTrack: initialHighScores,
    highScores: getTrackScores(initialHighScores, initialTrackId),
    lastRaceRank: null,
    playerPosition: 0,
    racerCount: 0,
    raceResults: [],

    speed: 0,
    maxSpeed: TOP_SPEED_KMH,
    boostAmount: 100,
    hasItem: false,
    currentItem: null,
    activeEffect: null,

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

      set((state) => ({
        selectedTrackId: trackId,
        ...resetRaceState(trackId),
        highScores: getTrackScores(state.highScoresByTrack, trackId),
      }));
    },

    setDifficulty: (difficulty) => set({ difficulty }),

    updateRacePosition: (position, count) =>
      set({ playerPosition: position, racerCount: count }),

    setRaceResults: (results) => set({ raceResults: results }),

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
        const trackId = state.selectedTrackId;
        const entry: HighScoreEntry = {
          id: `${Date.now()}`,
          trackId,
          totalTime: state.totalRaceTime,
          bestLapTime: newBestLap,
          achievedAt: new Date().toISOString(),
        };
        const trackScores = sortTrackScores([
          ...getTrackScores(state.highScoresByTrack, trackId),
          entry,
        ]);
        const highScoresByTrack = {
          ...state.highScoresByTrack,
          [trackId]: trackScores,
        };
        saveHighScores(highScoresByTrack);

        set({
          gameOver: true,
          isPlaying: false,
          lapTimes: newLapTimes,
          bestLapTime: newBestLap,
          highScoresByTrack,
          highScores: trackScores,
          lastRaceRank:
            trackScores.findIndex((score) => score.id === entry.id) + 1 || null,
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

    // Report the true km/h — the physics already caps velocity, so no upper
    // clamp here (speed-star + boost can legitimately exceed maxSpeed, which is
    // only the speedometer's full-scale). Clamping would understate the number.
    updateSpeed: (speed) => set({ speed: Math.max(0, speed) }),

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
  })),
);
