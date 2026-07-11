import { useEffect, useMemo, useRef } from "react";
import { getTrackLayout } from "./trackData";
import { raceStandings } from "../store/raceStandings";
import { carTransform } from "../store/carTransform";
import { useGameStore } from "../store/gameStore";

// HUD minimap (PLAN.md · G5/U1): the track centerline drawn once into a Path2D,
// re-stroked each animation frame with a dot per car. Deliberately outside
// React state — the dots read the same mutable singletons the race logic
// already writes every frame (raceStandings for AI, carTransform for the
// player), so the 60 Hz redraw costs zero re-renders.
const SIZE = 148; // CSS pixels, square
const PAD = 14; // keeps the road stroke inside the canvas
const PLAYER_COLOR = "#e63946"; // matches the player kart chassis (Car.tsx)

export function Minimap() {
  const selectedTrackId = useGameStore((state) => state.selectedTrackId);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // World→canvas transform + prebuilt road path for the selected track.
  const map = useMemo(() => {
    const layout = getTrackLayout(selectedTrackId);
    const pts = layout.points;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const span = Math.max(maxX - minX, maxZ - minZ) || 1;
    const scale = (SIZE - PAD * 2) / span;
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const toX = (x: number) => SIZE / 2 + (x - cx) * scale;
    const toY = (z: number) => SIZE / 2 + (z - cz) * scale;

    const path = new Path2D();
    pts.forEach((p, i) => {
      if (i === 0) path.moveTo(toX(p.x), toY(p.z));
      else path.lineTo(toX(p.x), toY(p.z));
    });
    path.closePath();

    // Start/finish tick: a short line across the road at sample 0.
    const p0 = pts[0];
    const p1 = pts[1];
    let tx = p1.x - p0.x;
    let tz = p1.z - p0.z;
    const tLen = Math.hypot(tx, tz) || 1;
    tx /= tLen;
    tz /= tLen;
    const tick = Math.max(3, (layout.width * scale) / 2 + 1.5);
    const startTick = {
      x0: toX(p0.x) - -tz * tick,
      y0: toY(p0.z) - tx * tick,
      x1: toX(p0.x) + -tz * tick,
      y1: toY(p0.z) + tx * tick,
    };

    return {
      toX,
      toY,
      path,
      startTick,
      roadPx: Math.max(3, layout.width * scale),
    };
  }, [selectedTrackId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);

      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
      ctx.lineWidth = map.roadPx;
      ctx.stroke(map.path);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 1;
      ctx.stroke(map.path);

      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(map.startTick.x0, map.startTick.y0);
      ctx.lineTo(map.startTick.x1, map.startTick.y1);
      ctx.stroke();

      for (const car of raceStandings.cars) {
        if (car.isPlayer || Number.isNaN(car.x)) continue;
        ctx.fillStyle = car.color;
        ctx.beginPath();
        ctx.arc(map.toX(car.x), map.toY(car.z), 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Player last, so it draws on top of any AI it overlaps.
      ctx.fillStyle = PLAYER_COLOR;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(map.toX(carTransform.x), map.toY(carTransform.z), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [map]);

  return (
    <div className="bg-black/60 backdrop-blur-sm rounded-xl p-2 border-2 border-cyan-400">
      <canvas ref={canvasRef} style={{ width: SIZE, height: SIZE }} />
    </div>
  );
}
