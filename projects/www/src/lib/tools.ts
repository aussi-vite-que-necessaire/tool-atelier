// Liste des outils affichés sur le dashboard. La SOURCE est l'ensemble des blocs
// `dashboard` déclarés dans projects/*/lab.json, matérialisés dans
// src/tools.generated.json par bin/www-tools-sync (le build Docker est scopé par
// projet → on ne lit pas les autres lab.json à la volée). Ne pas éditer le JSON
// à la main : modifier un lab.json puis relancer bin/www-tools-sync.
import generated from "@/tools.generated.json";

export type Tool = {
  name: string;
  label: string;
  tagline: string;
  url: string;
  order: number;
};

export const tools: Tool[] = generated.tools;
