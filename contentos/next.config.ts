import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Build autonome pour l'image Docker de prod (server.js + deps tracées).
  output: 'standalone',
  experimental: {
    serverActions: {
      // L'upload d'image (uploadImageAction) passe par une Server Action ;
      // la limite par défaut est 1 Mo. On autorise jusqu'à 12 Mo pour couvrir
      // le cap de 10 Mo du fichier (validateUploadFile) + l'overhead multipart.
      bodySizeLimit: '12mb',
    },
  },
};

export default nextConfig;
