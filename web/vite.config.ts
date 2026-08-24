import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  // Build straight into the folder Express already serves, so deploying stays
  // a single static-file mount with no extra server wiring.
  build: {
    outDir: path.resolve(import.meta.dirname, "../server/public"),
    emptyOutDir: true,
  },
  server: {
    // `npm run dev` talks to the local API instead of Vite's own origin.
    proxy: { "/api": "http://localhost:4000" },
  },
});
