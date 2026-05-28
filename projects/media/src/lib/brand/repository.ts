import { eq } from "drizzle-orm";
import { db } from "@/db";
import { brand } from "@/db/schema";
import { toBrandContext } from "./context";
import type { Brand } from "./context";

type BrandRow = typeof brand.$inferSelect;

const BRAND_ID = "brand";

export async function getBrand(): Promise<BrandRow | null> {
  const rows = await db.select().from(brand).where(eq(brand.id, BRAND_ID)).limit(1);
  return rows[0] ?? null;
}

export async function upsertBrand(data: {
  name: string;
  signature: string;
  logoUrl?: string | null;
}): Promise<BrandRow> {
  const [row] = await db
    .insert(brand)
    .values({ id: BRAND_ID, ...data, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: brand.id,
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

export async function getBrandContext(): Promise<Brand> {
  return toBrandContext(await getBrand());
}
