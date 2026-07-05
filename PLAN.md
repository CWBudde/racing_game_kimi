# PLAN.md — Game Review & Improvement Plan

Full review of the kart racing game (React 19 + three.js/R3F + Rapier + Zustand), based on a
line-by-line pass over every gameplay file, a production build, and lint. This document lists
everything found — bugs, design gaps, performance problems, and polish opportunities — and turns
them into a phased plan so the game improves in **all** directions: correctness, gameplay,
performance, content, audio, UX, and code health.

---

## 1. Ratings

| # | Category | Rating | One-line verdict |
|---|----------|:------:|------------------|
| 1 | Gameplay & game feel | **5 / 10** | Driving is fun and arcadey, but laps can be cheated, there is no off-track penalty, and racing the AI is meaningless (no positions). |
| 2 | Physics & handling | **6 / 10** | Solid impulse-based arcade model with grip/handbrake/boost; but `setAngvel` fights collisions, several lerps are frame-rate dependent, and there's no stuck/off-world recovery. |
| 3 | Visuals & environment | **7 / 10** | Three distinct themes (classic/desert/neon) with real atmosphere — neon is genuinely striking. All primitive geometry; no post-processing, skid marks, or particles beyond two static spheres. |
| 4 | Content & variety | **5 / 10** | 3 tracks, 5 item types, 2 AI cars — a decent base, but items barely differ, tracks are flat (y=0 everywhere), and there's one car with no customization. |
| 5 | UI / UX | **7 / 10** | Clean menu flow (track select → setup → F1-light countdown → HUD → results) with persistent top-5. Marred by a wrong speedometer, misleading "finish rank", and no minimap/position/wrong-way indicators. |
| 6 | Audio | **0 / 10** | No audio at all — no engine, collisions, pickups, countdown beeps, or music. |
| 7 | Performance & rendering | **4 / 10** | Per-frame Zustand writes re-render the entire React tree at 60 fps; ~260 barrier RigidBodies and ~100 multi-mesh trees with zero instancing; 3.4 MB JS bundle (1.16 MB gzip). |
| 8 | Code quality & architecture | **5 / 10** | Good recent refactors (trackData/carPhysics extraction), typed store, clean lint. But store misuse patterns, inline-IIFE canvas textures recreated every render, duplicated car meshes, dead exports, stale AGENTS.md. |
| 9 | Mobile & input | **6 / 10** | Touch buttons, keyboard, and (undocumented) gamepad support. But steering is digital-only on touch, keys stick on window blur, and touch controls render behind menus. |
| 10 | Completeness & progression | **4 / 10** | A race works end-to-end, but items are half-broken (see P0), AI don't race, and there is no progression (no ghosts, medals, unlocks, or settings). |

**Overall: 4.9 / 10** — a good-looking, playable prototype with a real content base, held back by
a handful of correctness bugs, a costly state-management pattern, and missing race fundamentals
(fair lap validation, opponent ranking, audio).

---

## 2. Findings

### 2.1 Bugs — gameplay-breaking (P0)

- **B1. Player almost certainly cannot collect item boxes; AI collect them instead.**
  `Environment.tsx:330-384` — the item sensor is a `CuboidCollider args={[0.9,0.9,0.9]}` on a body
  at `y=2.2`, so it spans **y ≈ 1.3–3.1**. The player collider (`Car.tsx:212`, half-height 0.5 at
  offset 0.6, body resting near y≈0) tops out at **≈ 1.1** — no overlap. The AI bodies sit at
  `y = pos.y + 0.5` (`AIOpponent.tsx:73-77`), so their colliders span ≈ 0.6–1.6 and *do* clip the
  sensor. `handleIntersection` (`Environment.tsx:305-311`) never inspects *which* body entered, so
  **AI cars grant random items to the player** while driving through boxes. Fix: lower the sensor
  (or extend it to the ground), and check `other.rigidBodyObject` / collision groups so only the
  player collects.
- **B2. Lap counting can be cheated and mis-fires.** `carPhysics.ts:311-334` — progress is the
  index of the nearest of 200 center-line points, and a lap only requires having once been within
  40–60 % progress before crossing 0.85→0.15. Cutting across the infield (the ground is flat and
  drivable everywhere) between those bands still counts. Nearest-point matching can also jump
  between adjacent track sections where the layout folds close to itself (e.g. coastal's
  crossover section). Fix: ordered checkpoint gates (the 8 decorative rings already exist —
  make them sensors) + a start/finish line sensor; require passing gates in sequence.
- **B3. Speedometer is clamped to half the real top speed.** Physics top speed is 45 m/s ⇒
  **162 km/h** (`carPhysics.ts:112,338`), but `updateSpeed` clamps to `maxSpeed: 80`
  (`gameStore.ts:174,295-296`) and the HUD bar uses `width: ${speed}%` (`GameUI.tsx:460`). The HUD
  reads "80 km/h" while flat out, and boost/speed-star effects are invisible. Fix: set
  `maxSpeed` from the physics constants and normalize the bar width.
- **B4. Leaderboard mixes all tracks into one top-5.** `HighScoreEntry` has no `trackId`
  (`gameStore.ts:10-15`), yet each track has different length/laps. Desert times will bury neon
  times forever. Fix: key high scores by track id; show the selected track's board in the menu.

### 2.2 Bugs — correctness & robustness (P1)

- **B5. Race timer drifts.** `App.tsx:24-32` adds a fixed 0.1 s per `setInterval(100 ms)` tick —
  intervals are throttled in background tabs and never exactly 100 ms, while the HUD displays
  centiseconds. Fix: accumulate `delta` in a `useFrame` (or `performance.now()` diff), and drive
  it from the same clock the physics uses.
- **B6. "Latest finish: #N" lies.** `lastRaceRank` (`gameStore.ts:272-273`) is the *local
  leaderboard* position, but the UI presents it as a race finish (`GameUI.tsx:87-89,354-358`).
  With AI on track, players will read it as their race position. Fix: compute a real race
  position vs AI (see G2), and label the leaderboard rank as "Leaderboard: #N".
- **B7. Keys stick on focus loss.** `carPhysics.ts:78-110` — no `blur`/`visibilitychange` handler
  resets the shared `keys` object; Alt-Tab while holding W leaves the car accelerating forever
  (also: pause does not clear keys). Fix: reset all keys on `window blur` and on pause.
- **B8. No recovery from leaving the world or getting stuck.** The ground collider is finite
  (`Track.tsx:146`, 1400×1400); beyond it the car falls forever, and there's no "reset to track"
  key. Fix: add a respawn action (R key / mobile button) that snaps to the nearest center-line
  point facing forward, plus an automatic reset when `y < -10`.
- **B9. AI cars hover above the road.** `AIOpponent.tsx:73` places the kinematic body at
  `pos.y + 0.5`, but the meshes are already modeled with wheels at y≈0 relative to the body —
  the AI visibly float ~0.4 m higher than the player car. Fix: drop the offset to ≈ 0.05.
- **B10. Frame-rate-dependent smoothing.** Camera lerps use per-frame constants
  (`CameraController.tsx:83-93`, factors 0.08/0.12/0.05), as do chassis tilt (`carPhysics.ts:358-368`)
  and countdown camera — on a 144 Hz monitor the camera is twice as stiff as at 60 Hz.
  The steering lerp already does this right (`1 - Math.pow(0.001, dt)`, `carPhysics.ts:204`); use
  the same exponential-decay form everywhere.
- **B11. Gamepad steering falsy-zero quirk.** `carPhysics.ts:181-182` uses
  `gamepadInput.steer || keyboard` — fine for 0, but a connected-but-centered gamepad also means
  D-pad + stick can't be mixed with keyboard cleanly, and `keys.a && keys.d` yields 0 with no
  arbitration. Minor; unify into one input-source resolution step.
- **B12. Boost never regenerates while SHIFT is held**, even at 0 boost with no throttle
  (`carPhysics.ts:344-346`) — holding shift out of habit permanently starves boost. Decide and
  document: regen only when not boosting *and* not pressed, or always regen below a threshold.

### 2.3 Performance (P1 — this is the biggest structural issue)

- **P1. Per-frame store writes re-render the whole app at 60 fps.**
  `updateSpeed`, `updateCarPosition`, `updateCarRotation` are called every frame
  (`carPhysics.ts:339-342`), and nearly every component subscribes to the **whole store** via
  destructuring (`GameScene` in `App.tsx:17`, `GameUI.tsx:116-140`, `CameraController.tsx:12-19`,
  `useCarPhysics` itself). Every physics tick re-renders GameScene, the HUD DOM, and the camera
  component. Fix (highest-leverage change in the codebase):
  - Keep **per-frame data out of React state**: put car position/rotation/speed in a mutable ref
    module (like `keys`) or `useGameStore.getState()`-written transient fields, read in
    `useFrame` via `subscribe` — the camera should read a ref, not props.
  - Throttle HUD updates to ~10 Hz, and convert all remaining subscriptions to **selectors**
    (`useGameStore(s => s.lap)` etc.).
  - `localSpeed` state for exhaust (`carPhysics.ts:160,340`) re-renders the whole car mesh tree
    every frame — replace with a ref + material visibility toggle.
- **P2. Canvas textures rebuilt every render.** The car number plates build a `<canvas>` in an
  inline IIFE inside JSX (`Car.tsx:125-168`, also `Track.tsx:316-338`, `Environment.tsx:362-379`).
  Combined with P1's per-frame re-render, the player car allocates **two canvases + textures per
  frame**. Fix: hoist into `useMemo` (AIOpponent already does this correctly, `AIOpponent.tsx:44-57`).
- **P3. No instancing.** ~260 barrier segments are each a `RigidBody` + 1-2 meshes
  (`Track.tsx:196-256`), ~100 trees are 4-5 meshes each, plus rocks/pylons/edge strips — thousands
  of draw calls and physics bodies. Fix: `InstancedMesh` (or drei `<Instances>`) for barriers,
  kerbs, trees, rocks, pylons; merge barrier colliders into fewer fixed bodies (or one fixed body
  with multiple colliders).
- **P4. Bundle is 3.4 MB (1.16 MB gzip).** Three + Rapier dominate, but `package.json` also
  carries ~30 unused libraries (recharts, embla, react-hook-form, zod, date-fns, react-day-picker,
  vaul, cmdk, input-otp…) and 53 shadcn components of which the game uses none directly. Fix:
  prune dependencies, add `manualChunks` (three/rapier/react vendors), lazy-load the Physics
  world behind the menu, and delete unused `src/components/ui/*`.
- **P5. Shadows everywhere.** 2048² shadow maps over a 560 m frustum with every tree/rock/barrier
  casting (`Environment.tsx:717-750`) — soft perf drain on mobile. Fix: shadow-cast only near
  geometry, tighten the shadow camera, or use a follow-the-car shadow frustum.

### 2.4 Gameplay & content gaps (P2)

- **G1. No off-track cost.** Grass/sand is as fast as asphalt, which combined with B2 makes
  cutting optimal. Fix: sample distance from center line (already computed for lap progress) and
  apply a drag multiplier + camera rumble when off the road.
- **G2. AI don't actually race.** Fixed-speed curve followers (`AIOpponent.tsx:59-91`) with no lap
  count, no finish, no player-relative position — and their `speedT` is hardcoded per track-agnostic
  seconds-per-lap (~21 s and ~24 s regardless of track length). Fix: give AI a progress/lap model,
  compute live race positions (HUD "P1/3"), scale speed to track length and difficulty, add light
  rubber-banding, and end the race with a results table (player vs AI times).
- **G3. Items are shallow and two of five are near-duplicates.** `turbo` is a 0.8 s impulse,
  `speed-star` a 5 s max-speed raise; `grip-boost` is imperceptible (0.85→0.95 lateral correction).
  No offensive/defensive items, no roulette animation on pickup. Fix: differentiate (shield,
  oil slick, missile if AI become real), add pickup roulette + sound, and show effects on the car
  (glow, trail).
- **G4. Tracks are completely flat** (all control points y=0) and share one width. Elevation,
  banking, bridges, or even a jump would transform variety. The track pipeline (Catmull-Rom +
  quad-strip + barrier sampler in `trackData.ts`) already supports 3D points — the car's
  up-slerp (`carPhysics.ts:290-309`, hard-locked to yaw-only) and `enabledRotations` would need
  pitch handling.
- **G5. No race-craft feedback:** no minimap, no wrong-way detection, no sector/delta times, no
  lap-time popup on crossing the line, no "final lap" callout.
- **G6. Single car, single color.** A 3-choice car select (different accel/top-speed/grip
  tradeoffs) is cheap — the car is parametric primitives, and the AI already re-color the same
  mesh (dedupe first, see C2).

### 2.5 Audio (P2 — from zero)

- **A1.** Engine loop pitched by speed (WebAudio oscillator or a small looped sample).
- **A2.** SFX: countdown beeps (matching the light steps), collision thud, item pickup/use, boost
  hiss, lap/final-lap chime, race-finish sting, off-track surface noise.
- **A3.** Menu + in-race music (theme-appropriate: chill for coastal, synthwave for neon).
- **A4.** Settings: master/music/SFX volume, persisted; default on with a mute button in the HUD.

### 2.6 UI / UX (P2)

- **U1.** HUD: race position (needs G2), minimap (draw the center line to a small canvas, dot per
  car), lap-time toast on lap completion, item roulette animation.
- **U2.** Results screen: per-lap time list (`lapTimes` is already stored but never displayed),
  AI comparison, "new best lap!" highlight.
- **U3.** Track select: draw a mini track-shape preview per card from its control points (cheap
  and very high perceived value), show per-track best time (needs B4).
- **U4.** Pause: also stop the countdown when ESC is pressed mid-countdown (currently ESC is
  ignored because `isPlaying` is false, but the countdown keeps running — `App.tsx:98-109`).
- **U5.** The always-on "controls" hint reappears every un-pause; show once per session instead.
- **U6.** Settings panel: shadows on/off, DPR cap, camera distance/FOV, colorblind-safe kerb
  palette — the shadcn component library is already shipped; use it or drop it (see P4).

### 2.7 Mobile & input (P2)

- **M1.** Touch steering is digital (-1/0/1). Add an analog option: virtual joystick or tilt;
  at minimum ramp steering while held (the lerp helps but target is still ±0.8 instantly).
- **M2.** Touch controls render (inert, behind overlays) on menus and while paused
  (`MobileController.tsx:35-42` has no game-state check) — hide unless `isPlaying`.
- **M3.** Buttons at `bottom-28` collide with the HUD bottom row on small landscape phones —
  reflow HUD when touch controls are active.
- **M4.** Gamepad works but is undocumented — add it to the controls card; add rumble on
  collision (`gamepad.vibrationActuator`) and a "press any button" start.
- **M5.** Add `blur` key-reset (B7) and prevent context menu / double-tap zoom on the buttons.

### 2.8 Code quality & architecture (P3)

- **C1. Stale docs.** AGENTS.md describes gravity -20, mass 500, `MAX_SPEED=45/ACCELERATION=18`,
  "no AI opponents", "completeLap never called", "no item handlers" — all now false (gravity is
  -10 in `App.tsx:61`, mass 80 in `carPhysics.ts:120`, AI/items/laps exist). Rewrite AGENTS.md to
  match reality; it actively misleads any agent working here.
- **C2. Car mesh duplication.** `Car.tsx` and `AIOpponent.tsx` are ~90 % the same primitive kart —
  extract a shared `<KartModel color number />` used by both.
- **C3. Dead code:** `TRACK_POINTS`, `TRACK_SIDES`, `TRACK_WIDTH` exports are unused
  (`trackData.ts:147,219-220`); `ITEM_INFO.duration` is unused for instant items; the checkpoint
  rings are decorative only (recycle them for B2). `package.json` is still `my-app@0.0.0`.
- **C4. Store hygiene:** split transient per-frame data from persistent race state (see P1);
  `ITEM_POOLS` keyed by raw string track ids with a silent fallback — key it off `TrackDefinition`.
- **C5. Magic numbers** for physics/AI tuning scattered across files — collect into a
  `tuning.ts` with named constants so difficulty/handling can be balanced in one place.
- **C6. No tests.** Pure logic is now nicely extracted (`trackData.ts` samplers, store reducers,
  lap logic) — add Vitest for: high-score persistence/sorting, `completeLap` flow, barrier
  segment generation, progress/checkpoint ordering (after B2). Wire into CI before deploy.
- **C7. CI:** deploy workflow builds `main` only; add a PR workflow running
  `tsc -b`, `eslint`, and tests.

---

## 3. Phased roadmap

### Phase 0 — Correctness (make the game honest) 🔴
- [x] B1: Fix item sensor height + filter collector to the player body
- [ ] B2: Sequential checkpoint gates + start/finish sensor for lap validation
- [ ] B3: Speedometer range/clamp fix
- [ ] B4: Per-track leaderboards
- [ ] B5: Delta-time race timer
- [ ] B6: Honest rank labeling (until G2 lands)
- [ ] B7/M5: Key reset on blur/pause
- [ ] B8: Respawn key + fall-off auto-reset
- [ ] B9: AI ride-height fix

### Phase 1 — Performance foundation 🟠
- [ ] P1: Transient per-frame state out of React; selectors everywhere; HUD at ~10 Hz
- [ ] P2: Memoize all canvas textures
- [ ] P3: Instance barriers/trees/rocks/kerbs; consolidate barrier colliders
- [ ] P4: Prune unused deps + shadcn components; vendor chunking; measure bundle again
- [ ] P5: Shadow budget (near-field casters, tighter frustum)
- [ ] B10: Frame-rate-independent camera/tilt smoothing

### Phase 2 — Make it a race 🟡
- [ ] G2: AI progress/laps, live positions in HUD, tuned + rubber-banded speeds, results vs AI
- [ ] G1: Off-track slowdown
- [ ] G5/U1: Minimap, wrong-way warning, lap-time toast, final-lap callout
- [ ] U2: Lap-time breakdown on results
- [ ] A1/A2: Engine sound + core SFX (countdown, collision, pickup, lap)

### Phase 3 — Depth & delight 🟢
- [ ] G3: Item rework (roulette, distinct effects, visual feedback on car)
- [ ] G6/C2: Shared kart model + player car/color select
- [ ] G4: One track with elevation/banking (pipeline generalization)
- [ ] A3/A4: Music + audio settings
- [ ] U3: Track-shape previews + per-track bests in the menu
- [ ] M1–M4: Analog touch steering, state-aware touch UI, gamepad docs/rumble
- [ ] Visual polish: skid marks, drift/boost particles, post-processing (bloom for neon)

### Phase 4 — Code health (parallel, ongoing) ⚪
- [ ] C1: Rewrite AGENTS.md to match the current architecture
- [ ] C3/C4/C5: Dead code removal, store split, tuning constants module
- [ ] C6: Vitest for store/track/lap logic
- [ ] C7: PR CI (typecheck + lint + test)
- [ ] U4/U5/U6: Countdown-pause, hint once, settings panel

**Suggested order of attack:** Phase 0 is small (each item is hours, not days) and removes
everything that makes the game feel broken. Phase 1 P1+P2 should land before any new features,
because every future feature gets cheaper once per-frame rendering is fixed. Phases 2→3 are the
visible payoff; Phase 4 runs alongside everything.
