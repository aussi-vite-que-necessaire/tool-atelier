import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

// Astro Node SSR (standalone) — produit dist/server/entry.mjs lancé par `node`.
// Toutes les routes tournent côté serveur (auth, listing skills, download zip).
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: { port: 8080, host: true },
  vite: {
    plugins: [tailwindcss()],
  },
});
