// Lecture centralisée des variables runtime (injectées par la plateforme + secrets).
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variable d'environnement manquante: ${name}`);
  return v;
}

export const config = {
  geminiApiKey: () => required("GEMINI_API_KEY"),
  browserUrl: () => required("BROWSER_URL"),
  r2: () => ({
    endpoint: required("R2_S3_ENDPOINT"),
    accessKeyId: required("R2_ACCESS_KEY_ID"),
    secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    bucket: required("R2_BUCKET"),
    publicBaseUrl: required("R2_PUBLIC_BASE_URL"),
  }),
  // Préfixe de clés R2 : vide en prod, "<env>/" sinon → isole les écritures de preview.
  keyPrefix: () => {
    const env = process.env.APP_ENV ?? "dev";
    return env === "prod" ? "" : `${env}/`;
  },
};
