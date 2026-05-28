import { describe, expect, test } from 'vitest';
import { listIdeas } from '@/lib/db/repositories/ideas';
import { createVoice, listVoices } from '@/lib/db/repositories/voice';
import { listWritingTemplates } from '@/lib/db/repositories/writing-templates';
import { seedRedaction } from '../../scripts/seed-redaction';
import { createTestUser } from './helpers/seed';

describe('seed-redaction', () => {
  test('crée voix + template + idée, et est idempotent', async () => {
    const userId = await createTestUser('seedredac');
    await seedRedaction(userId);
    await seedRedaction(userId); // deuxième passage : pas de doublon

    const voices = await listVoices(userId);
    expect(voices.filter((v) => v.name === 'Manu')).toHaveLength(1);

    const templates = await listWritingTemplates(userId);
    expect(templates.filter((t) => t.name === 'Post-thèse LinkedIn')).toHaveLength(1);

    const ideas = await listIdeas(userId);
    expect(ideas.filter((i) => i.idea.startsWith('AVQN'))).toHaveLength(1);

    const voice = voices.find((v) => v.name === 'Manu');
    expect(voice?.content).toContain('contraste mesuré');
  });

  test("met à jour le contenu d'une voix « Manu » préexistante (convergence)", async () => {
    const userId = await createTestUser('seedredacconv');
    // Une voix « Manu » périmée existe déjà (cas réel).
    await createVoice(userId, { name: 'Manu', content: 'contenu périmé' });

    await seedRedaction(userId);

    const voices = await listVoices(userId);
    const manu = voices.filter((v) => v.name === 'Manu');
    expect(manu).toHaveLength(1); // pas de doublon
    expect(manu[0]?.content).toContain('contraste mesuré'); // contenu riche appliqué
    expect(manu[0]?.content.length).toBeGreaterThan(5000);
  });
});
