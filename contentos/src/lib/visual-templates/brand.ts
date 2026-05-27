import { getSettings } from '@/lib/db/repositories/settings';

// Contexte de marque injecté dans tout template visuel sous le handle `brand`.
// Toutes les clés sont toujours présentes (strict mode Handlebars) : chaîne vide
// quand non renseigné. `signature` vaut null si vide pour que `{{#ifNotEmpty}}`
// la traite comme absente.
export type Brand = {
  name: string;
  signature: string | null;
  logo: string;
};

export const EMPTY_BRAND: Brand = {
  name: '',
  signature: null,
  logo: '',
};

export async function buildBrandContext(userId: string): Promise<Brand> {
  const settings = await getSettings(userId);
  if (!settings) return EMPTY_BRAND;
  return {
    name: settings.brandName,
    signature: settings.brandSignature.length > 0 ? settings.brandSignature : null,
    logo: settings.brandLogoUrl ?? '',
  };
}
