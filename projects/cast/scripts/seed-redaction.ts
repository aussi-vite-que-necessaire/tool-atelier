#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
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
  const { db } = await import('@/lib/db/client');
  const { user } = await import('@/lib/db/schema');

  async function resolveUserId(arg: string): Promise<string | undefined> {
    if (arg.includes('@')) {
      const rows = await db.select({ id: user.id }).from(user).where(eq(user.email, arg)).limit(1);
      return rows[0]?.id;
    }
    return arg;
  }

  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: npm run seed:redaction -- <email|userId>');
    process.exit(1);
  }
  const userId = await resolveUserId(arg);
  if (!userId) {
    console.error(`Aucun user trouvé pour "${arg}". Connecte-toi d'abord, puis relance.`);
    process.exit(1);
  }
  await seedRedaction(userId);
  console.log(`\nDone. user=${userId}`);
  process.exit(0);
}
