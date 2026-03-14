import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../store/gameStore";

const COURSE_AUDIO: Record<string, string> = {
  "coastal-gp": "/normal.mp3",
  "desert-run": "/neon.mp3",
};

export function CourseMusic() {
  const selectedCourseId = useGameStore((state) => state.selectedCourseId);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    const audio = new Audio();
    audio.loop = true;
    audio.volume = 0.45;
    audio.preload = "auto";
    audioRef.current = audio;

    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const unlock = () => setIsUnlocked(true);

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    const nextSrc = COURSE_AUDIO[selectedCourseId] ?? COURSE_AUDIO["coastal-gp"];
    if (!audio) return;

    if (!audio.src.endsWith(nextSrc)) {
      audio.src = nextSrc;
      audio.load();
    }

    if (!isUnlocked) return;

    audio.play().catch(() => {
      // Autoplay can still be blocked until the browser accepts a user gesture.
    });
  }, [isUnlocked, selectedCourseId]);

  return null;
}
