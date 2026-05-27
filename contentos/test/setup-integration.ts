import { beforeEach } from 'vitest';
import { db } from '@/lib/db/client';
import {
  account,
  carouselSlides,
  ideas,
  imageAssets,
  media,
  oauthAccessToken,
  oauthApplication,
  oauthConsent,
  posts,
  publications,
  session,
  settings,
  socialAccounts,
  styleGuides,
  user,
  verification,
  visualStyles,
  visualTemplates,
  voice,
  writingTemplates,
} from '@/lib/db/schema';

// Reset complet de la DB avant chaque test integration/worker pour isolation.
// L'ordre respecte les FK : on supprime les tables référençantes avant les référencées.
beforeEach(async () => {
  await db.delete(imageAssets);
  await db.delete(carouselSlides);
  await db.delete(publications);
  await db.delete(posts);
  await db.delete(media);
  await db.delete(ideas);
  await db.delete(visualStyles);
  await db.delete(visualTemplates);
  await db.delete(styleGuides);
  await db.delete(writingTemplates);
  await db.delete(voice);
  await db.delete(settings);
  await db.delete(socialAccounts);
  await db.delete(oauthAccessToken);
  await db.delete(oauthConsent);
  await db.delete(oauthApplication);
  await db.delete(account);
  await db.delete(session);
  await db.delete(verification);
  await db.delete(user);
});
