// Dérive l'URL de connexion d'admin (base "postgres") à partir d'une URL cible,
// pour exécuter CREATE DATABASE avant que la base cible n'existe.
export function adminUrl(targetUrl: string): string {
  const u = new URL(targetUrl);
  u.pathname = '/postgres';
  return u.toString();
}

export function dbNameFromUrl(targetUrl: string): string {
  return new URL(targetUrl).pathname.replace(/^\//, '');
}
