#!/usr/bin/env tsx
import { seedDev } from '@/lib/db/seeds/dev-sample';

// Seede les données cast d'un user existant (table "user", auth in-app).
// Ici on attend juste un userId déjà connu.
async function main(): Promise<void> {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: npm run db:seed -- <userId>');
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
