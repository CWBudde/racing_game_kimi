// Transient per-frame car state, kept deliberately OUT of React/Zustand.
//
// The physics loop updates the car's position, heading and speed 60×/second.
// Routing those through the Zustand store made every per-frame write re-render
// the whole React tree (GameScene, HUD, camera component) — the single biggest
// performance problem in the app. This is a plain mutable singleton (like the
// shared `keys` object): the physics loop writes it each frame and the camera
// reads it each frame, both inside `useFrame`, so nothing re-renders.
export const carTransform = {
  x: 0,
  y: 0,
  z: 0,
  yaw: 0,
  speedKmh: 0,
};

// Seed the transient from a known pose (used when a race/countdown begins) so
// the camera has a valid target on the very first frame instead of a stale one.
export const seedCarTransform = (
  position: [number, number, number],
  yaw: number,
) => {
  carTransform.x = position[0];
  carTransform.y = position[1];
  carTransform.z = position[2];
  carTransform.yaw = yaw;
  carTransform.speedKmh = 0;
};
