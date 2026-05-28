// Identité de test utilisée pour l'auto-login en preview.
export const PREVIEW_USER = 'preview@cast.local';
// ID stable du preview user, seedé en base preview.
export const PREVIEW_USER_ID = 'preview-user';
// Code OTP déterministe accepté en preview (jamais en prod). Conservé
// tant que des helpers de test ou anciens flux y font référence ;
// l'OTP réel passe désormais par auth.contentos.ch.
export const PREVIEW_OTP = '000000';

// Preview = environnement déployé non-prod (APP_ENV = slug de branche).
// En prod APP_ENV vaut 'prod' ; en local il est absent. APP_ENV est le seul
// discriminant fiable : NODE_ENV vaut 'production' en preview comme en prod.
// On lit process.env directement (et non env.ts) pour rester sans dépendance :
// ce module est ainsi importable dans des tests purs sans parser tout l'env.
export function isPreviewEnv(appEnv: string | undefined): boolean {
  return !!appEnv && appEnv !== 'prod';
}

export const isPreview = isPreviewEnv(process.env.APP_ENV);
