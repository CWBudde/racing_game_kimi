import { useEffect } from "react";
import { useGameStore } from "../store/gameStore";
import {
  playFinishSting,
  playItemPickup,
  playItemUse,
  playLapChime,
  unlockAudio,
} from "./audioEngine";

// Renders nothing. Unlocks the AudioContext on the first user gesture
// (browser autoplay policy) and bridges store *transitions* to one-shot SFX
// via subscriptions, so no gameplay code has to know about audio and the
// component never re-renders. Frame-rate audio (engine pitch, boost hiss)
// lives in the physics loop instead; the countdown beeps fire from the
// overlay that owns the light-step timer.
export function AudioDirector() {
  useEffect(() => {
    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  // Item slot transitions: filled = pickup blip; emptied mid-race = use zap.
  // The isPlaying guard keeps race resets (which also clear the slot) silent —
  // every reset path clears isPlaying in the same store update.
  useEffect(
    () =>
      useGameStore.subscribe(
        (state) => state.hasItem,
        (hasItem, prevHasItem) => {
          if (hasItem && !prevHasItem) {
            playItemPickup();
          } else if (!hasItem && prevHasItem && useGameStore.getState().isPlaying) {
            playItemUse();
          }
        },
      ),
    [],
  );

  // A grown lapTimes array is a closed lap (same detection as the HUD toast).
  // The chime for the second-to-last lap doubles as the final-lap callout; the
  // race-closing lap sets gameOver in the same store update and is covered by
  // the finish sting below instead.
  useEffect(
    () =>
      useGameStore.subscribe(
        (state) => state.lapTimes,
        (times, prevTimes) => {
          if (times.length === 0 || times.length <= prevTimes.length) return;
          const { totalLaps, gameOver } = useGameStore.getState();
          if (gameOver) return;
          playLapChime(times.length === totalLaps - 1);
        },
      ),
    [],
  );

  useEffect(
    () =>
      useGameStore.subscribe(
        (state) => state.gameOver,
        (gameOver, prevGameOver) => {
          if (gameOver && !prevGameOver) playFinishSting();
        },
      ),
    [],
  );

  return null;
}
