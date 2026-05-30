/**
 * Applique les règles éditoriales inviolables de la voix (cohérentes avec
 * la default voice du seed) sur un texte généré par Claude.
 *
 * Règles :
 * - Pas de tiret cadratin (—) : remplacé par virgule + espace.
 * - Pas de lignes vides multiples (max 1 ligne vide entre paragraphes).
 * - Pas d'espaces de fin de ligne ni de fin de texte.
 *
 * Idempotent : lintEditorial(lintEditorial(x)) === lintEditorial(x).
 */
export function lintEditorial(text: string): string {
  let out = text;

  // Tiret cadratin : remplace par ", " (gère les espaces autour).
  out = out.replace(/\s*—\s*/g, ', ');

  // Espaces de fin de ligne.
  out = out.replace(/[ \t]+(\n|$)/g, '$1');

  // Lignes vides multiples → max 1 ligne vide.
  out = out.replace(/\n{3,}/g, '\n\n');

  // Trim global.
  out = out.trim();

  return out;
}
