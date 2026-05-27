import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie autonome : l'image Docker n'embarque que le serveur + les deps utiles.
  output: "standalone",
};

export default nextConfig;
