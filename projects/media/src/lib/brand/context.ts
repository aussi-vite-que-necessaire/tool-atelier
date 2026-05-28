import type { brand } from "@/db/schema";

type BrandRow = typeof brand.$inferSelect;

// Contexte injecté dans tout template sous le handle `brand` (cf. templates/compile).
export type Brand = { name: string; signature: string | null; logo: string };
export const EMPTY_BRAND: Brand = { name: "", signature: null, logo: "" };

export function toBrandContext(row: BrandRow | null): Brand {
  if (!row) return EMPTY_BRAND;
  return {
    name: row.name,
    signature: row.signature.length > 0 ? row.signature : null,
    logo: row.logoUrl ?? "",
  };
}
