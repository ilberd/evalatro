import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: Vite on :5173 proxies API/SSE to the Node relay on :3001.
// Prod: `vite build` → web/dist, which the Node relay serves directly.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/events": { target: "http://localhost:3001", ws: false },
      "/ingest": "http://localhost:3001",
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
