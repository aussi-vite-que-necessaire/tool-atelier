import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { brand } from '@/lib/db/schema';

type BrandRow = typeof brand.$inferSelect;

// Contexte injecté dans tout template sous le handle `brand` (cf. templates/compile).
export type Brand = { name: string; signature: string | null; logo: string };
export const EMPTY_BRAND: Brand = { name: '', signature: null, logo: '' };

export function toBrandContext(row: BrandRow | null): Brand {
  if (!row) return EMPTY_BRAND;
  return {
    name: row.name,
    signature: row.signature.length > 0 ? row.signature : null,
    logo: row.logoUrl ?? '',
  };
}

export async function getBrand(userId: string): Promise<BrandRow | null> {
  const rows = await db.select().from(brand).where(eq(brand.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertBrand(
  userId: string,
  data: { name: string; signature: string; logoUrl?: string | null },
): Promise<BrandRow> {
  const [row] = await db
    .insert(brand)
    .values({ userId, ...data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: brand.userId,
      set: {
        name: data.name,
        signature: data.signature,
        logoUrl: data.logoUrl ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row!;
}

export async function getBrandContext(userId: string): Promise<Brand> {
  return toBrandContext(await getBrand(userId));
}
