import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Embarque les fichiers des skills dans le build standalone (sinon absents
  // du conteneur runtime, qui ne copie que .next/standalone, static et public).
  // La page d'accueil lit les manifestes ; la route /api/skills/[name]/download
  // zippe le contenu à la volée.
  outputFileTracingIncludes: {
    "/": ["./skills/**/*"],
    "/api/skills/[name]/download": ["./skills/**/*"],
  },
};

export default nextConfig;
