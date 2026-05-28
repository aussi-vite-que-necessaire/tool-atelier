import { eq } from "drizzle-orm";
import { db } from "@/db";
import { brand } from "@/db/schema";
import { toBrandContext } from "./context";
import type { Brand } from "./context";

type BrandRow = typeof brand.$inferSelect;

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
