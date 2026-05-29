// Identité de test utilisée pour l'auto-login en preview.
export const PREVIEW_USER_EMAIL = "preview@docs.local"
// ID stable du preview user.
export const PREVIEW_USER_ID = "preview-user"

// Preview = environnement déployé non-prod (APP_ENV = slug de branche).
// En prod APP_ENV vaut 'prod' ; en local il est absent. APP_ENV est le seul
// discriminant fiable : NODE_ENV vaut 'production' en preview comme en prod.
// On lit process.env directement (et non env.ts) pour rester sans dépendance :
// ce module est ainsi importable dans des tests purs sans parser tout l'env.
export function isPreviewEnv(appEnv: string | undefined): boolean {
  return !!appEnv && appEnv !== "prod"
}

export const isPreview = isPreviewEnv(process.env.APP_ENV)

// Identités de preview (convention partagée avec auth + autres clients).
export const PREVIEW_OP_1_ID = "preview-op-1"
export const PREVIEW_OP_2_ID = "preview-op-2"
export const PREVIEW_AUD_3_ID = "preview-aud-3"
// docs est l'app publique « audience » → auto-connect user3 (audience).
export const DEFAULT_PREVIEW_USER: 1 | 2 | 3 = 3

const MARKER = "cos_preview_login"
// Marqueur posé au logout en preview : tant qu'il est là, on montre le chooser.
export function hasManualMarker(cookieHeader: string | null | undefined): boolean {
  return !!cookieHeader && new RegExp(`(?:^|;\\s*)${MARKER}=manual`).test(cookieHeader)
}

// URL de redirection pour un visiteur sans session. Pur (pas d'env) → testable.
// preview sans marqueur → auto-login ; preview avec marqueur ou prod → chooser SSO.
export function loginRedirect(opts: {
  authUrl: string
  back: string
  preview: boolean
  cookieHeader: string | null | undefined
  defaultUser?: 1 | 2 | 3
}): string {
  const r = encodeURIComponent(opts.back)
  if (opts.preview && !hasManualMarker(opts.cookieHeader)) {
    return `${opts.authUrl}/preview-login?user=${opts.defaultUser ?? DEFAULT_PREVIEW_USER}&redirect=${r}`
  }
  return `${opts.authUrl}/sign-in?redirect=${r}`
}
