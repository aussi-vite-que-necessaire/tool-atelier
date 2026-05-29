export { DEFAULT_PREVIEW_USER } from './preview-users';

// Preview = environnement déployé non-prod (APP_ENV = slug de branche).
// En prod APP_ENV vaut 'prod' ; en local il est absent. APP_ENV est le seul
// discriminant fiable : NODE_ENV vaut 'production' en preview comme en prod.
// On lit process.env directement (et non env.ts) pour rester sans dépendance :
// ce module est ainsi importable dans des tests purs sans parser tout l'env.
export function isPreviewEnv(appEnv: string | undefined): boolean {
  return !!appEnv && appEnv !== 'prod';
}

export const isPreview = isPreviewEnv(process.env.APP_ENV);

// Présence d'un cookie de session BetterAuth (auth in-app, une seule origine).
export function hasSessionCookie(cookieHeader: string | null | undefined): boolean {
  return !!cookieHeader && /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(cookieHeader);
}

const MARKER = 'cos_preview_login';
// Marqueur posé au logout en preview : tant qu'il est là, on montre le chooser
// (page /signin) au lieu d'auto-connecter l'opérateur de test.
export function hasManualMarker(cookieHeader: string | null | undefined): boolean {
  return !!cookieHeader && new RegExp(`(?:^|;\\s*)${MARKER}=manual`).test(cookieHeader);
}

// URL de redirection pour un visiteur sans session. Pure (pas d'env) → testable.
// preview sans marqueur → auto-login local (/preview-login) ;
// preview avec marqueur, ou prod → page de connexion locale (/signin).
export function loginRedirect(opts: {
  back: string;
  preview: boolean;
  cookieHeader: string | null | undefined;
  defaultUser?: string;
}): string {
  const r = encodeURIComponent(opts.back);
  if (opts.preview && !hasManualMarker(opts.cookieHeader)) {
    return `/preview-login?user=${opts.defaultUser ?? '1'}&redirect=${r}`;
  }
  return `/signin?redirect=${r}`;
}
