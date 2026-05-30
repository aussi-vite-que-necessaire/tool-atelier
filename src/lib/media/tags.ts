// Gestion des tags et du clamp de limite. Logique pure, testable hors runtime.

export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

export function serializeTags(tags: string[] | null | undefined): string {
  return JSON.stringify(tags ?? []);
}

// Intersection : toutes les tags demandées doivent être présentes.
export function hasAllTags(imageTags: string[], required: string[]): boolean {
  return required.every((t) => imageTags.includes(t));
}

export function clampLimit(limit: number | undefined, def = 20, max = 100): number {
  if (limit === undefined || !Number.isFinite(limit) || limit <= 0) return def;
  return Math.min(Math.floor(limit), max);
}
