import { defineConfig } from "vite";

const base = process.env.VITE_BASE ?? "./";

export default defineConfig({
  base,
  appType: "mpa",
  publicDir: "public",
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
