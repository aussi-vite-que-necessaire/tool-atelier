#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createPublicationFormat,
  listPublicationFormats,
  updatePublicationFormat,
} from '@/lib/db/repositories/publication-formats';
import { createVoice, listVoices, updateVoice } from '@/lib/db/repositories/voice';

const DIR = join(process.cwd(), 'scripts', 'seed-redaction');
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');

export async function seedRedaction(userId: string): Promise<void> {
  const voices = await listVoices(userId);
  const existingVoice = voices.find((v) => v.name === 'Manu');
  if (existingVoice) {
    await updateVoice(userId, existingVoice.id, { content: read('voix-manu.md') });
  } else {
    await createVoice(userId, { name: 'Manu', content: read('voix-manu.md') });
  }

  const formats = await listPublicationFormats(userId);
  const existingFormat = formats.find((t) => t.name === 'Post-thèse LinkedIn');
  if (existingFormat) {
    await updatePublicationFormat(userId, existingFormat.id, {
      structure: read('post-these-structure.md'),
      writingRules: read('post-these-rules.md'),
    });
  } else {
    await createPublicationFormat(userId, {
      name: 'Post-thèse LinkedIn',
      platform: 'linkedin',
      structure: read('post-these-structure.md'),
      writingRules: read('post-these-rules.md'),
    });
  }
}

// CLI runner — exécuté uniquement quand ce fichier est l'entrée directe
const isDirectRun =
  typeof process.argv[1] !== 'undefined' && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  runCli().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

async function runCli(): Promise<void> {
  // La table user vit côté auth.contentos.ch — on attend juste un userId connu.
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: npm run seed:redaction -- <userId>');
    process.exit(1);
  }
  await seedRedaction(userId);
  console.log(`\nDone. user=${userId}`);
  process.exit(0);
}
