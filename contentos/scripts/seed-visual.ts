#!/usr/bin/env tsx
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { user } from '@/lib/db/schema';
import { seedVisualTemplates } from '@/lib/db/seeds/visual-templates';

async function resolveUserId(arg: string): Promise<string | undefined> {
  if (arg.includes('@')) {
    const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, arg)).limit(1);
    return rows[0]?.id;
  }
  return arg;
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npm run seed:visual -- <email|userId>');
    process.exit(1);
  }
  const userId = await resolveUserId(arg);
  if (!userId) {
    console.error(`Aucun user trouvé pour "${arg}". Connecte-toi d'abord, puis relance.`);
    process.exit(1);
  }
  const result = await seedVisualTemplates(userId);
  console.log(`\nDone. user=${userId} created=${result.created} skipped=${result.skipped}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
