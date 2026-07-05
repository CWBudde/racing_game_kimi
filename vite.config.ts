import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
export default defineConfig({
  base: '/racing_game_kimi/',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Raise the warning threshold: the Rapier physics core is a ~2 MB WASM-glue
    // bundle we can't meaningfully split, so 500 kB would always warn.
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        // Split the two heaviest leaf libraries (three.js and the Rapier core)
        // into their own vendor chunks so they cache independently of app code
        // instead of sitting in one 3.4 MB blob. Everything else (react, the
        // @react-three bindings, zustand) stays together to avoid the circular
        // chunk that separating @react-three/rapier from @react-three/fiber
        // would create.
        manualChunks(id) {
          // Normalize to POSIX separators first: on Windows Rollup module ids
          // use backslashes, so a raw "/three/" check would never match and the
          // chunking (and its caching benefit) would silently regress.
          const normalized = id.replace(/\\/g, "/");
          if (normalized.includes("node_modules")) {
            if (normalized.includes("/three/")) return "three";
            if (normalized.includes("@dimforge")) return "rapier";
            return "vendor";
          }
        },
      },
    },
  },
});
