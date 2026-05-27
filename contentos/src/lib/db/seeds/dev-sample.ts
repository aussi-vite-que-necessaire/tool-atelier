import { createIdea, listIdeas } from '../repositories/ideas';
import { createPost, listPosts } from '../repositories/posts';
import { upsertSettings } from '../repositories/settings';
import { createVoice, listVoices } from '../repositories/voice';
import { createWritingTemplate, listWritingTemplates } from '../repositories/writing-templates';
import {
  DEFAULT_VOICE_CONTENT,
  DEFAULT_VOICE_NAME,
  DEFAULT_WRITING_TEMPLATE,
} from './user-defaults';
import { seedVisualTemplates } from './visual-templates';

const SAMPLE_IDEAS = [
  {
    idea: 'Pourquoi je documente mes specs avant de coder',
    brief: 'Angle : gain de temps réel vs surcoût perçu.',
  },
  {
    idea: 'Le piège des tests qui partagent la base de dev',
    brief: 'Anecdote : données effacées à chaque run.',
  },
  { idea: 'Construire en solo avec des agents IA', brief: null as string | null },
];

const SAMPLE_POSTS = [
  {
    title: 'Documenter avant de coder',
    content:
      'Documenter une spec avant de coder, ça paraît lent. En réalité ça évite trois allers-retours.',
  },
  {
    title: 'Une base de test dédiée',
    content:
      'Mes tests effaçaient ma base de dev à chaque run. Une base de test dédiée a réglé le problème en cinq minutes.',
  },
];

async function seedUserDefaultsIdempotent(userId: string): Promise<void> {
  await upsertSettings(userId);
  if ((await listVoices(userId)).length === 0) {
    await createVoice(userId, { name: DEFAULT_VOICE_NAME, content: DEFAULT_VOICE_CONTENT });
  }
  const templates = await listWritingTemplates(userId);
  if (!templates.some((t) => t.name === DEFAULT_WRITING_TEMPLATE.name)) {
    await createWritingTemplate(userId, DEFAULT_WRITING_TEMPLATE);
  }
}

export async function seedDev(userId: string): Promise<void> {
  await seedUserDefaultsIdempotent(userId);
  await seedVisualTemplates(userId);

  const byText = new Map((await listIdeas(userId)).map((i) => [i.idea, i]));
  for (const s of SAMPLE_IDEAS) {
    if (!byText.has(s.idea)) {
      const created = await createIdea(userId, { idea: s.idea, brief: s.brief ?? undefined });
      byText.set(created.idea, created);
    }
  }

  const existingContent = new Set((await listPosts(userId)).map((p) => p.content));
  for (const p of SAMPLE_POSTS) {
    if (!existingContent.has(p.content)) {
      await createPost(userId, { title: p.title, content: p.content, status: 'draft' });
    }
  }
}
