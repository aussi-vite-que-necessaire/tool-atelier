export const TABS = ["upload", "generate", "pdf"] as const;
export type Tab = (typeof TABS)[number];

// ?tab= inconnu ou absent → onglet par défaut.
export function resolveTab(raw: string | undefined): Tab {
  return TABS.includes(raw as Tab) ? (raw as Tab) : "upload";
}
