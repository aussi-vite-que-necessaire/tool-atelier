import { createPost, listPosts } from '../repositories/posts';
import {
  createPublication,
  listPublications,
  updatePublication,
} from '../repositories/publications';
import { upsertSettings } from '../repositories/settings';
import { createVoice, listVoices } from '../repositories/voice';
import { createWritingTemplate, listWritingTemplates } from '../repositories/writing-templates';
import {
  DEFAULT_VOICE_CONTENT,
  DEFAULT_VOICE_NAME,
  DEFAULT_WRITING_TEMPLATE,
} from './user-defaults';

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

  const postsByContent = new Map((await listPosts(userId)).map((p) => [p.content, p]));
  for (const p of SAMPLE_POSTS) {
    if (!postsByContent.has(p.content)) {
      const created = await createPost(userId, {
        title: p.title,
        content: p.content,
        status: 'draft',
      });
      postsByContent.set(created.content, created);
    }
  }

  // Une publication planifiée + une publiée pour que la home ait quelque chose à montrer.
  if ((await listPublications(userId)).length === 0) {
    const day = 24 * 60 * 60 * 1000;
    const scheduledPost = postsByContent.get(SAMPLE_POSTS[0]!.content);
    if (scheduledPost) {
      await createPublication(userId, {
        postId: scheduledPost.id,
        contentSnapshot: scheduledPost.content,
        platform: 'linkedin',
        status: 'scheduled',
        scheduledFor: new Date(Date.now() + 2 * day),
      });
    }
    const publishedPost = postsByContent.get(SAMPLE_POSTS[1]!.content);
    if (publishedPost) {
      const publication = await createPublication(userId, {
        postId: publishedPost.id,
        contentSnapshot: publishedPost.content,
        platform: 'linkedin',
        status: 'published',
      });
      await updatePublication(userId, publication.id, {
        publishedAt: new Date(Date.now() - 2 * day),
        externalUrl: 'https://www.linkedin.com/feed/',
      });
    }
  }
}
