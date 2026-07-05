// Shared car speed constants — single source of truth for the physics model
// (carPhysics.ts) and the HUD speedometer (gameStore.ts / GameUI.tsx). Kept in
// its own module so the store can read them without importing carPhysics, which
// would create an import cycle (carPhysics imports the store).

export const MAX_SPEED = 45; // m/s — base top speed
export const BOOST_MULTIPLIER = 1.5; // multiplies top speed while boosting

// Boosted top speed converted to km/h. Used as the speedometer's full-scale so
// the gauge has headroom above the ~162 km/h unboosted top and the needle
// actually moves when boosting. Speed-star (a further 1.5x) can pin it past 100%.
export const TOP_SPEED_KMH = Math.round(MAX_SPEED * BOOST_MULTIPLIER * 3.6); // 243
