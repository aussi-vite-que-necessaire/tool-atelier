// Auto-login preview : code OTP déterministe accepté hors prod (jamais en prod).
export const PREVIEW_USER = "preview@local";
export const PREVIEW_OTP = "000000";

// Preview = déployé non-prod (APP_ENV = slug de branche). Prod : APP_ENV === "prod".
// On lit process.env directement pour rester importable sans parser tout l'env.
export function isPreviewEnv(appEnv: string | undefined): boolean {
  return !!appEnv && appEnv !== "prod";
}

export const isPreview = isPreviewEnv(process.env.APP_ENV);
