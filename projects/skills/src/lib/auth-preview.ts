// Helpers de preview : code OTP figé pour itérer sans email réel.
// Activé quand APP_URL pointe sur un *-<env>.preview.contentos.ch OU NODE_ENV=development.
const url = process.env.APP_URL ?? "";
const host = (() => {
  try { return new URL(url).host; } catch { return ""; }
})();
const isPreviewHost = /^[^.]+-[a-z0-9-]+\.preview\.contentos\.ch$/.test(host);

export const isPreview = process.env.NODE_ENV !== "production" || isPreviewHost;
export const PREVIEW_OTP = "000000";
