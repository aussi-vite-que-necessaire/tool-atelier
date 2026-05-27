import { describe, expect, test } from 'vitest';
import { variableSpecSchema } from '@/lib/visual-templates/dsl';

describe('variableSpecSchema — schéma de spec exposé au MCP', () => {
  test('accepte une variable list', () => {
    const r = variableSpecSchema.safeParse({
      name: 'items',
      label: 'Points clés',
      type: 'list',
      minItems: 2,
      maxItems: 4,
      itemMax: 110,
    });
    expect(r.success).toBe(true);
  });

  test('accepte une variable color', () => {
    const r = variableSpecSchema.safeParse({
      name: 'accent',
      label: 'Couleur',
      type: 'color',
      default: '#1a1a1a',
    });
    expect(r.success).toBe(true);
  });

  test('accepte encore string et image', () => {
    expect(
      variableSpecSchema.safeParse({ name: 'titre', label: 'Titre', type: 'string', max: 120 })
        .success,
    ).toBe(true);
    expect(
      variableSpecSchema.safeParse({ name: 'photo', label: 'Photo', type: 'image' }).success,
    ).toBe(true);
  });

  test('rejette un type inconnu', () => {
    const r = variableSpecSchema.safeParse({ name: 'x', label: 'X', type: 'video' });
    expect(r.success).toBe(false);
  });

  test('rejette une string sans max', () => {
    const r = variableSpecSchema.safeParse({ name: 'x', label: 'X', type: 'string' });
    expect(r.success).toBe(false);
  });
});
