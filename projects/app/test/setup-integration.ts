import { beforeEach } from 'vitest';
import { db } from '@/lib/db/client';
import { posts, publicationFormats, publications, socialAccounts, voice } from '@/lib/db/schema';

// Reset complet de la DB avant chaque test integration/worker pour isolation.
// L'ordre respecte les FK : on supprime les tables référençantes avant les référencées.
// La table user vit côté auth.contentos.ch, plus locale.
beforeEach(async () => {
  await db.delete(publications);
  await db.delete(posts);
  await db.delete(publicationFormats);
  await db.delete(voice);
  await db.delete(socialAccounts);
});
