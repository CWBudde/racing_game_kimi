# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with hot reload
npm run build     # TypeScript check (tsc -b) then production build
npm run preview   # Serve production build locally
npm run lint      # Run ESLint
```

Bun is also supported (`bun run dev`, etc.). No test framework is configured.

## Deployment

CI/CD via `.github/workflows/deploy.yml` — every push to `main` runs `bun install && bun run build` and auto-deploys `./dist` to GitHub Pages.

## Architecture

**Stack:** React 19 + TypeScript + Vite | Three.js via `@react-three/fiber` + `@react-three/drei` | Rapier physics via `@react-three/rapier` | Zustand state | Tailwind + shadcn/ui overlay

The game is a full-screen `<Canvas>` (react-three/fiber) with HTML overlays for HUD and controls. `App.tsx` is the root — it wraps everything in a Rapier `<Physics>` world (gravity -20 Y), renders `<GameScene>` (3D world) plus `<GameUI>` and `<MobileController>` as DOM overlays.

### State: `src/store/gameStore.ts`
Central Zustand store with `subscribeWithSelector`. Holds all game state: `isPlaying`, `isPaused`, `gameOver`, lap counters, `currentLapTime`, `bestLapTime`, `speed`, `boostAmount`, `hasItem`, `carPosition`, `carRotation`. Actions: `startGame`, `pauseGame`, `resumeGame`, `resetGame`, `completeLap`, `updateSpeed`, `updateCarPosition`, etc.

### Car physics: `src/components/Car.tsx`
The most complex file. A Rapier `RigidBody` (mass 500) + `CuboidCollider`. Each `useFrame`:
1. Reads keyboard from exported mutable `keys` object (shared with `MobileController`)
2. Decomposes velocity into forward/lateral using yaw quaternion
3. Applies impulse-based acceleration (`MAX_SPEED=45`, `ACCELERATION=18`)
4. Sets angular velocity for steering (`MAX_STEERING_ANGLE=0.35`)
5. Applies lateral grip correction impulse (reduced when handbrake active)
6. Slerps rotation to keep car upright
7. Animates wheel rotation and chassis tilt cosmetically
8. Manages boost (regenerates 5/sec idle, drains 20/sec when SHIFT+W held)

### Track: `src/components/Track.tsx`
18 `THREE.Vector3` control points forming a GP circuit, sampled via `THREE.CatmullRomCurve3` (200 segments). Renders ground plane, road quad-strip geometry with canvas-textured asphalt, kerbs, barrier `RigidBody` colliders, 8 animated checkpoint rings, and start/finish line. Exports `TRACK_POINTS` and `getTrackStart()`.

### Camera: `src/components/CameraController.tsx`
Returns `null` (pure logic). Each `useFrame`: reads store position/rotation, places camera 15 units behind + 8 above, lerps position (0.08) and look-target (0.12). FOV lerps 60→75 based on speed ratio.

### Environment: `src/components/Environment.tsx`
Populates world with trees (near + far field), rocks, animated clouds, item box sensor RigidBodies along the track, background mountains, and lighting (sun + directional + ambient + hemisphere).

### UI: `src/components/GameUI.tsx`
HTML overlay (no Three.js). Renders start screen, pause screen, game-over screen, and racing HUD (lap counter, timer, speedometer, boost meter, item slot). The `src/components/ui/` directory contains 40+ shadcn/ui components.

## Incomplete Features (Known)

- **Lap progression**: `completeLap()` exists in the store but is never called — no checkpoint collision detection is wired.
- **Item pickups**: `ItemBox` components are sensor RigidBodies but no collision handler calls `collectItem()`/`useItem()`.
- **Item effects**: `useItem()` clears state but applies no gameplay effect.
- No AI opponents, no audio.
