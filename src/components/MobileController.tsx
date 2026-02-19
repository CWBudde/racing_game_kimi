import { useCallback, useEffect, useState } from "react";
import { keys } from "./Car";

export function MobileController() {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice("ontouchstart" in window || navigator.maxTouchPoints > 0);
  }, []);

  // Prevent default on touch to avoid scrolling / zooming
  const prevent = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDown = useCallback(
    (key: keyof typeof keys) => (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      keys[key] = true;
    },
    [],
  );

  const handleUp = useCallback(
    (key: keyof typeof keys) => (e: React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      keys[key] = false;
    },
    [],
  );

  if (!isTouchDevice) return null;

  return (
    <div
      className="absolute inset-0 z-30 pointer-events-none select-none"
      style={{ touchAction: "none" }}
      onTouchMove={prevent}
    >
      {/* ---- Left side: Steering ---- */}
      <div className="absolute left-3 bottom-28 flex gap-3 pointer-events-auto">
        {/* Left */}
        <button
          className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center active:bg-white/40 transition-colors"
          onTouchStart={handleDown("a")}
          onTouchEnd={handleUp("a")}
          onTouchCancel={handleUp("a")}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Right */}
        <button
          className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center active:bg-white/40 transition-colors"
          onTouchStart={handleDown("d")}
          onTouchEnd={handleUp("d")}
          onTouchCancel={handleUp("d")}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {/* ---- Right side: Gas & Brake ---- */}
      <div className="absolute right-3 bottom-28 flex flex-col gap-3 pointer-events-auto">
        {/* Gas */}
        <button
          className="w-20 h-24 rounded-2xl bg-green-500/50 backdrop-blur-sm border-2 border-green-300/60 flex items-center justify-center active:bg-green-500/80 transition-colors"
          onTouchStart={handleDown("w")}
          onTouchEnd={handleUp("w")}
          onTouchCancel={handleUp("w")}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 15 12 9 18 15" />
          </svg>
        </button>

        {/* Brake */}
        <button
          className="w-20 h-24 rounded-2xl bg-red-500/50 backdrop-blur-sm border-2 border-red-300/60 flex items-center justify-center active:bg-red-500/80 transition-colors"
          onTouchStart={handleDown("s")}
          onTouchEnd={handleUp("s")}
          onTouchCancel={handleUp("s")}
        >
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* ---- Extra buttons: Boost & Handbrake ---- */}
      <div className="absolute right-28 bottom-28 flex flex-col gap-3 pointer-events-auto">
        {/* Boost */}
        <button
          className="w-16 h-16 rounded-full bg-purple-500/50 backdrop-blur-sm border-2 border-purple-300/60 flex items-center justify-center text-white text-xs font-bold active:bg-purple-500/80 transition-colors"
          onTouchStart={handleDown("shift")}
          onTouchEnd={handleUp("shift")}
          onTouchCancel={handleUp("shift")}
        >
          <span className="leading-tight text-center">NOS</span>
        </button>

        {/* Handbrake */}
        <button
          className="w-16 h-16 rounded-full bg-yellow-500/50 backdrop-blur-sm border-2 border-yellow-300/60 flex items-center justify-center text-white text-xs font-bold active:bg-yellow-500/80 transition-colors"
          onTouchStart={handleDown("space")}
          onTouchEnd={handleUp("space")}
          onTouchCancel={handleUp("space")}
        >
          <span className="leading-tight text-center">HB</span>
        </button>
      </div>
    </div>
  );
}
