// Lecture centralisée des variables runtime du module media (secrets R2, Gemini,
// Chromium). Tout est optionnel au boot : l'app démarre sans, et chaque capacité
// se désactive proprement si son secret manque (pas de throw au chargement de
// module). Les helpers `*Configured()` permettent à l'UI/aux actions de dégrader
// avec un message clair plutôt que de crasher.
//
// `CONTENT_OS_MEDIA_STUB=1` force le mode dégradé : aucune capacité n'est active,
// quels que soient les secrets présents (CI/dev sans accès plateforme).

export class MediaUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MediaUnavailableError';
  }
}

function stub(): boolean {
  return process.env.CONTENT_OS_MEDIA_STUB === '1';
}

function val(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export type R2Config = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

// Vrai si toutes les variables R2 sont présentes (stockage opérationnel).
export function isStorageConfigured(): boolean {
  if (stub()) return false;
  return (
    !!val('R2_S3_ENDPOINT') &&
    !!val('R2_ACCESS_KEY_ID') &&
    !!val('R2_SECRET_ACCESS_KEY') &&
    !!val('R2_BUCKET') &&
    !!val('R2_PUBLIC_BASE_URL')
  );
}

export function isGeminiConfigured(): boolean {
  return !stub() && !!val('GEMINI_API_KEY');
}

export function isBrowserConfigured(): boolean {
  return !stub() && !!val('BROWSER_URL');
}

export const config = {
  geminiApiKey(): string {
    const v = val('GEMINI_API_KEY');
    if (!v)
      throw new MediaUnavailableError(
        'Génération d’image indisponible : GEMINI_API_KEY manquante.',
      );
    return v;
  },
  browserUrl(): string {
    const v = val('BROWSER_URL');
    if (!v)
      throw new MediaUnavailableError('Rendu HTML→image indisponible : BROWSER_URL manquant.');
    return v;
  },
  r2(): R2Config {
    if (!isStorageConfigured()) {
      throw new MediaUnavailableError('Stockage média indisponible : configuration R2 incomplète.');
    }
    return {
      endpoint: val('R2_S3_ENDPOINT')!,
      accessKeyId: val('R2_ACCESS_KEY_ID')!,
      secretAccessKey: val('R2_SECRET_ACCESS_KEY')!,
      bucket: val('R2_BUCKET')!,
      publicBaseUrl: val('R2_PUBLIC_BASE_URL')!,
    };
  },
  // Préfixe de clés R2 : vide en prod, "<env>/" sinon → isole les écritures de preview.
  keyPrefix(): string {
    const appEnv = process.env.APP_ENV ?? 'dev';
    return appEnv === 'prod' ? '' : `${appEnv}/`;
  },
};
