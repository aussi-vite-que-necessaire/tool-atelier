// Preview = environnement déployé non-prod (APP_ENV = slug de branche).
export function isPreviewEnv(appEnv: string | undefined): boolean {
  return !!appEnv && appEnv !== "prod";
}
export const isPreview = isPreviewEnv(process.env.APP_ENV);
export const PREVIEW_USER_ID = "preview-user";
