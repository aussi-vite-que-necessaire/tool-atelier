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
  // La page /embed est destinée à être chargée en iframe par les autres apps de la
  // suite (cast en prod + previews). frame-ancestors restreint qui peut l'embarquer ;
  // l'allowlist applicative (isAllowedParentOrigin) + la validation event.origin côté
  // appelant complètent cette défense. Le reste du site n'est jamais framable.
  async headers() {
    return [
      {
        source: "/embed/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://cast.contentos.ch https://*.preview.contentos.ch",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
