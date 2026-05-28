#!/usr/bin/env tsx
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { user } from '@/lib/db/schema';
import { seedDev } from '@/lib/db/seeds/dev-sample';

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
    console.error('Usage: npm run db:seed -- <email|userId>');
    process.exit(1);
  }
  const userId = await resolveUserId(arg);
  if (!userId) {
    console.error(`Aucun user trouvé pour "${arg}". Connecte-toi d'abord, puis relance.`);
    process.exit(1);
  }
  await seedDev(userId);
  console.log(`\nDone. user=${userId}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
