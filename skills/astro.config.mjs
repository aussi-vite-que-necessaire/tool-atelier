import { defineConfig, passthroughImageService } from "astro/config";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

// Astro Node SSR (standalone) — produit dist/server/entry.mjs lancé par `node`.
// Pas d'optimisation d'image côté serveur (passthrough = sharp non requis), pour
// rester sur node:22-alpine sans recompiler de natives.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: { port: 8080, host: true },
  image: { service: passthroughImageService() },
  vite: {
    plugins: [tailwindcss()],
  },
});
