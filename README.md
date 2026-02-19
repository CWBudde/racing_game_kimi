# racing_game_kimi

This started as a **one-shot experiment with KIMI K2.5** (Feb 2026): a small **3D kart racing prototype** built with React, Vite, and a Three.js + Rapier physics stack. The first prototype (see history) was built very quickly, but the physics were kind of broken. It took a few claude sessions and some manual adjustment to get it actually working to some extent. There is still plenty of room for improvement, but it was a fun experiment to see, where we currently are with KIMI for this kind of project.

## What’s in here

- Procedural track mesh + simple colliders
- Physics-driven car (rigid body) with arcade-ish handling
- Chase camera with speed-based FOV
- HUD overlay (lap/time/speed/boost) + pause/menu screens

## Controls

- `W` / `↑`: accelerate
- `S` / `↓`: brake / reverse
- `A` / `←`: steer left
- `D` / `→`: steer right
- `SPACE`: handbrake (reduced grip)
- `SHIFT`: boost (consumes boost meter)
- `ESC`: pause / resume

## Run locally

Prereqs: Node.js 20+

Using Bun:

```bash
bun install
bun run dev
```

Using npm:

```bash
npm install
npm run dev
```

Other scripts:

- `bun run build` / `npm run build`
- `bun run preview` / `npm run preview`
- `bun run lint` / `npm run lint`

## Tech stack

- React + TypeScript + Vite
- @react-three/fiber + three
- @react-three/rapier (physics)
- Zustand (game state)
- Tailwind CSS (+ shadcn/ui components present in repo)

## Code map

- [src/App.tsx](src/App.tsx): Canvas + scene composition + ESC pause handler
- [src/components/Car.tsx](src/components/Car.tsx): car physics + input
- [src/components/Track.tsx](src/components/Track.tsx): procedural track mesh + colliders
- [src/components/CameraController.tsx](src/components/CameraController.tsx): chase camera
- [src/components/GameUI.tsx](src/components/GameUI.tsx): HUD + start/pause/game-over screens
- [src/store/gameStore.ts](src/store/gameStore.ts): game state

## Current state / limitations

This is intentionally “prototype-y”. A few things are scaffolded but not fully wired yet:

- Laps/checkpoints exist visually, but lap progression and race completion aren’t currently triggered.
- Item boxes exist as sensors in the scene, but item pickup/use logic isn’t connected.

