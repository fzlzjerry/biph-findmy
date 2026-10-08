import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The browser only ever talks to its own origin: /api/* and /media/* are proxied to FastAPI in
// development and served by the same deployment in production (no CDNs — works in mainland China).
const backend = process.env.FINDMY_API ?? "http://localhost:8000";
const proxy = {
  "/api": { target: backend, changeOrigin: false },
  "/media": { target: backend, changeOrigin: false },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    assetsInlineLimit: 2048,
    rolldownOptions: {
      output: {
        // Stable vendor chunks: app deploys don't invalidate the (large, rarely changing) framework code.
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/ },
            { name: "vendor", test: /node_modules[\\/]/ },
          ],
        },
      },
    },
  },
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
});
