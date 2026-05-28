import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie autonome : l'image Docker n'embarque que le serveur + les deps utiles.
  output: "standalone",
  experimental: {
    serverActions: {
      // Augmente la limite pour les uploads image/PDF via l'UI (jusqu'à ~100 Mo).
      // Les vidéos > 100 Mo passent par l'API de service /v1/upload.
      bodySizeLimit: "100mb",
    },
  },
};

export default nextConfig;
