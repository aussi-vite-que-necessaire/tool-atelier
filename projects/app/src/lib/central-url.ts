/* @generated — synchronisé depuis packages/ui par bin/ui-sync. Ne pas éditer ici : modifier packages/ui puis relancer la synchro. */
/**
 * URL du site central de la suite (contentos.ch), résolue depuis APP_ENV.
 *
 * `deploy.sh` injecte APP_ENV = 'prod' en prod, sinon le slug de branche (preview).
 * En preview on vise le www de la même branche (`www-<slug>.preview.contentos.ch`).
 * Ce www n'existe que s'il a été déployé sur la branche — sinon le lien est mort,
 * ce qui est acceptable en contexte de revue de preview.
 */
export function centralUrl(appEnv?: string): string {
  if (!appEnv || appEnv === 'prod') return 'https://contentos.ch';
  return `https://www-${appEnv}.preview.contentos.ch`;
}
