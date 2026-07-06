// Shared car speed constants — single source of truth for the physics model
// (carPhysics.ts) and the HUD speedometer (gameStore.ts / GameUI.tsx). Kept in
// its own module so the store can read them without importing carPhysics, which
// would create an import cycle (carPhysics imports the store).

export const MAX_SPEED = 45; // m/s — base top speed
export const BOOST_MULTIPLIER = 1.5; // multiplies top speed while boosting

// --- Kart handling constants -------------------------------------------------
// The force model in kartForces.ts (shared by the player and the AI) reads these.
// Kept here so handling can be tuned in one place (see PLAN.md · C5).
export const MAX_REVERSE_SPEED = 15; // m/s cap when reversing
export const ACCELERATION = 8; // base longitudinal accel
export const DECELERATION = 4; // coast damping factor
export const BRAKE_FORCE = 35; // braking decel
export const STEERING_SPEED = 5.0; // yaw rate scale
export const MAX_STEERING_ANGLE = 0.8; // max steer input magnitude
export const CAR_MASS = 80; // rigid-body mass (player + AI)

// Boosted top speed converted to km/h. Used as the speedometer's full-scale so
// the gauge has headroom above the ~162 km/h unboosted top and the needle
// actually moves when boosting. Speed-star (a further 1.5x) can pin it past 100%.
export const TOP_SPEED_KMH = Math.round(MAX_SPEED * BOOST_MULTIPLIER * 3.6); // 243
