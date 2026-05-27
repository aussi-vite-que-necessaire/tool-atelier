import { describe, expect, test } from 'vitest';
import { variableSpecInput, visualImpl } from '@/lib/mcp/tools/visuals';
import { createTestUser } from './helpers/seed';

const baseTemplate = {
  slug: 'mcp-tpl',
  label: 'MCP',
  platform: 'linkedin',
  width: 1080,
  height: 1080,
  bodyHtml: '<div>{{titre}}</div>',
  css: 'div{}',
  variablesSchema: [{ name: 'titre', label: 'Titre', type: 'string' as const, max: 120 }],
  sampleVars: { titre: 'Exemple' },
};

describe('mcp tools — templates visuels', () => {
  test('create → get (specs parsées) → list', async () => {
    const userId = await createTestUser('mcpvt');
    const tpl = await visualImpl.createTemplate(userId, baseTemplate);
    expect(tpl?.slug).toBe('mcp-tpl');

    const got = await visualImpl.getTemplate(userId, { id: tpl!.id });
    expect(got.variableSpecs.map((s) => s.name)).toContain('titre');

    const list = await visualImpl.listTemplates(userId);
    expect(list.some((t) => t.id === tpl!.id)).toBe(true);
  });

  test('create avec variablesSchema invalide → throw (rien créé)', async () => {
    const userId = await createTestUser('mcpvtbad');
    await expect(
      visualImpl.createTemplate(userId, {
        ...baseTemplate,
        slug: 'bad',
        variablesSchema: [{ nope: true }],
      }),
    ).rejects.toThrow();
  });

  test('update + delete', async () => {
    const userId = await createTestUser('mcpvtud');
    const tpl = await visualImpl.createTemplate(userId, baseTemplate);
    const updated = await visualImpl.updateTemplate(userId, { id: tpl!.id, label: 'Renommé' });
    expect(updated?.label).toBe('Renommé');
    await visualImpl.deleteTemplate(userId, { id: tpl!.id });
    await expect(visualImpl.getTemplate(userId, { id: tpl!.id })).rejects.toThrow(/introuvable/);
  });

  test('create avec list + color → get (specs reparsées intactes)', async () => {
    const userId = await createTestUser('mcpvtlc');
    const tpl = await visualImpl.createTemplate(userId, {
      ...baseTemplate,
      slug: 'mcp-tpl-lc',
      bodyHtml: '<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>',
      css: '.u{background:{{accent}}}',
      variablesSchema: [
        {
          name: 'items',
          label: 'Points',
          type: 'list' as const,
          minItems: 1,
          maxItems: 5,
          itemMax: 110,
        },
        { name: 'accent', label: 'Couleur', type: 'color' as const, default: '#1a1a1a' },
      ],
      sampleVars: { items: ['un', 'deux'], accent: '#1a1a1a' },
    });
    expect(tpl?.slug).toBe('mcp-tpl-lc');

    const got = await visualImpl.getTemplate(userId, { id: tpl!.id });
    const byName = Object.fromEntries(got.variableSpecs.map((s) => [s.name, s.type]));
    expect(byName).toEqual({ items: 'list', accent: 'color' });
  });
});

describe('mcp tools — schéma de variables exposé', () => {
  test('variableSpecInput accepte list et color, rejette un type inconnu', () => {
    expect(
      variableSpecInput.safeParse({
        name: 'items',
        label: 'Points',
        type: 'list',
        minItems: 1,
        maxItems: 5,
        itemMax: 110,
      }).success,
    ).toBe(true);
    expect(
      variableSpecInput.safeParse({ name: 'accent', label: 'Couleur', type: 'color' }).success,
    ).toBe(true);
    expect(variableSpecInput.safeParse({ name: 'x', label: 'X', type: 'video' }).success).toBe(
      false,
    );
  });
});

describe('mcp tools — styles visuels', () => {
  test('create → list → update → delete', async () => {
    const userId = await createTestUser('mcpvs');
    const style = await visualImpl.createStyle(userId, { name: 'Néon', prompt: 'style néon' });
    expect((await visualImpl.listStyles(userId)).some((s) => s.id === style.id)).toBe(true);
    const upd = await visualImpl.updateStyle(userId, { id: style.id, name: 'Néon 2' });
    expect(upd?.name).toBe('Néon 2');
    await visualImpl.deleteStyle(userId, { id: style.id });
    expect((await visualImpl.listStyles(userId)).some((s) => s.id === style.id)).toBe(false);
  });
});
