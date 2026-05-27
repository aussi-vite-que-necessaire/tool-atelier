import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  // Embarque les fichiers du skill dans le build standalone pour la route de téléchargement
  // (sinon absents du conteneur runtime, qui ne copie que .next/standalone, static et public).
  outputFileTracingIncludes: {
    "/api/admin/skill": ["./skills/creer-une-ressource/**/*"],
  },
}

export default nextConfig
