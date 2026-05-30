// Les domaines de la suite contentos, ordonnés tels qu'ils apparaissent dans la
// navbar et le drawer. `segment` est le premier segment d'URL ; il sert à la fois
// de cible (`/${segment}`) et de clé pour déduire l'item actif depuis usePathname.
export type SuiteEntry = {
  segment: string;
  label: string;
  tagline: string;
  available: boolean;
};

export const SUITE_ENTRIES: SuiteEntry[] = [
  { segment: 'cast', label: 'Cast', tagline: 'Publier sur LinkedIn', available: true },
  { segment: 'media', label: 'Media', tagline: 'Visuels & vidéos', available: false },
  {
    segment: 'ressources',
    label: 'Ressources',
    tagline: 'Lead magnets & espace docs',
    available: true,
  },
  { segment: 'skills', label: 'Skills', tagline: 'Compétences agentiques', available: true },
];

// Item actif = premier segment de pathname (ex. /cast/posts → cast).
export function activeSegment(pathname: string | null): string | null {
  if (!pathname) return null;
  const first = pathname.split('/').filter(Boolean)[0];
  return first ?? null;
}
