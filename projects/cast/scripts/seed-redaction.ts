#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createIdea, listIdeas } from '@/lib/db/repositories/ideas';
import { createVoice, listVoices, updateVoice } from '@/lib/db/repositories/voice';
import {
  createWritingTemplate,
  listWritingTemplates,
  updateWritingTemplate,
} from '@/lib/db/repositories/writing-templates';

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

  const templates = await listWritingTemplates(userId);
  const existingTemplate = templates.find((t) => t.name === 'Post-thèse LinkedIn');
  if (existingTemplate) {
    await updateWritingTemplate(userId, existingTemplate.id, {
      structure: read('post-these-structure.md'),
      writingRules: read('post-these-rules.md'),
    });
  } else {
    await createWritingTemplate(userId, {
      name: 'Post-thèse LinkedIn',
      platform: 'linkedin',
      structure: read('post-these-structure.md'),
      writingRules: read('post-these-rules.md'),
    });
  }

  const ideaFile = read('idee-avqn.md');
  const [titleLine, ...rest] = ideaFile.split('\n');
  const title = (titleLine ?? '').replace(/^#\s*/, '').trim();
  const brief = rest.join('\n').trim();
  const ideas = await listIdeas(userId);
  if (!ideas.some((i) => i.idea.startsWith('AVQN'))) {
    await createIdea(userId, { idea: title, brief });
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
