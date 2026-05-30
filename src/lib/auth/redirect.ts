// Cible de redirection après connexion/inscription. Redirection INTERNE
// uniquement (chemin relatif, même origine) — jamais d'URL externe. À défaut de
// cible valide, on entre dans la suite par la section cast.
export function safeRedirect(raw: string | null | undefined): string {
  if (!raw) return '/cast';
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/cast';
}
