// Preview = environnement déployé non-prod (APP_ENV = slug de branche).
// En prod APP_ENV vaut 'prod' ; en local il est absent. APP_ENV est le seul
// discriminant fiable : NODE_ENV vaut 'production' en preview comme en prod.
// On lit process.env directement (et non env.ts) pour rester sans dépendance :
// ce module est ainsi importable dans des tests purs sans parser tout l'env.
export function isPreviewEnv(appEnv: string | undefined): boolean {
  return !!appEnv && appEnv !== "prod";
}

export const isPreview = isPreviewEnv(process.env.APP_ENV);

// ID stable du preview user. Sert de userId par défaut pour toutes les requêtes
// en preview (UI admin, MCP), pour que les données preview restent isolées et
// reproductibles.
export const PREVIEW_USER_ID = "preview-user";
