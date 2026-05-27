import { describe, expect, test } from 'vitest';
import {
  parseVariablesSchema,
  type VariablesSchema,
  variablesSchemaToZod,
} from '@/lib/visual-templates/dsl';

describe('parseVariablesSchema', () => {
  test('accepte un schéma string valide', () => {
    const raw = [{ name: 'title', label: 'Titre', type: 'string', max: 50 }];
    expect(parseVariablesSchema(raw)).toEqual(raw);
  });

  test('accepte string avec min, description, optional', () => {
    const raw = [
      {
        name: 'a',
        label: 'A',
        type: 'string',
        min: 5,
        max: 50,
        optional: true,
        description: 'help',
      },
    ];
    expect(parseVariablesSchema(raw)).toEqual(raw);
  });

  test('rejette string sans max', () => {
    expect(() => parseVariablesSchema([{ name: 'a', label: 'A', type: 'string' }])).toThrow();
  });

  test('rejette type inconnu', () => {
    expect(() =>
      parseVariablesSchema([{ name: 'a', label: 'A', type: 'number', max: 5 }]),
    ).toThrow();
  });

  test('rejette name avec un caractère invalide', () => {
    expect(() =>
      parseVariablesSchema([{ name: 'has space', label: 'X', type: 'string', max: 5 }]),
    ).toThrow();
  });

  test('rejette noms dupliqués', () => {
    const raw = [
      { name: 'a', label: 'A', type: 'string', max: 5 },
      { name: 'a', label: 'A2', type: 'string', max: 5 },
    ];
    expect(() => parseVariablesSchema(raw)).toThrow(/duplicate/i);
  });

  test('rejette input non-array', () => {
    expect(() => parseVariablesSchema({})).toThrow();
    expect(() => parseVariablesSchema(null)).toThrow();
  });
});

describe('variablesSchemaToZod', () => {
  const schema: VariablesSchema = [
    { name: 'title', label: 'Titre', type: 'string', min: 1, max: 50 },
    { name: 'subtitle', label: 'Sous', type: 'string', max: 140, optional: true },
  ];
  const zod = variablesSchemaToZod(schema);

  test('accepte des valeurs valides', () => {
    expect(zod.parse({ title: 'Hello', subtitle: 'World' })).toEqual({
      title: 'Hello',
      subtitle: 'World',
    });
  });

  test('accepte optional manquant', () => {
    expect(zod.parse({ title: 'Hello' })).toEqual({ title: 'Hello' });
  });

  test('rejette required manquant', () => {
    expect(() => zod.parse({ subtitle: 'World' })).toThrow();
  });

  test('rejette trop court (min = 1, vide après trim)', () => {
    expect(() => zod.parse({ title: '   ' })).toThrow();
  });

  test('rejette trop long', () => {
    expect(() => zod.parse({ title: 'x'.repeat(51) })).toThrow();
  });

  test('trim whitespace', () => {
    expect(zod.parse({ title: '  Hello  ' })).toEqual({ title: 'Hello' });
  });
});

describe('image variables', () => {
  test('parse une var image', () => {
    const raw = [{ name: 'photo', label: 'Photo', type: 'image' }];
    expect(parseVariablesSchema(raw)).toEqual(raw);
  });

  test('parse une var image optionnelle', () => {
    const raw = [{ name: 'photo', label: 'Photo', type: 'image', optional: true }];
    expect(parseVariablesSchema(raw)).toEqual(raw);
  });

  test('type inconnu rejeté', () => {
    expect(() => parseVariablesSchema([{ name: 'x', label: 'X', type: 'video' }])).toThrow();
  });

  test('zod : image requise = mediaId non vide', () => {
    const zod = variablesSchemaToZod([{ name: 'photo', label: 'P', type: 'image' }]);
    expect(zod.parse({ photo: 'media123' })).toEqual({ photo: 'media123' });
    expect(() => zod.parse({ photo: '' })).toThrow();
    expect(() => zod.parse({})).toThrow();
  });

  test('zod : image optionnelle peut manquer', () => {
    const zod = variablesSchemaToZod([
      { name: 'photo', label: 'P', type: 'image', optional: true },
    ]);
    expect(zod.parse({})).toEqual({});
  });

  test('schéma mixte string + image', () => {
    const raw = [
      { name: 'title', label: 'T', type: 'string', max: 50 },
      { name: 'photo', label: 'P', type: 'image' },
    ];
    expect(parseVariablesSchema(raw)).toEqual(raw);
  });
});
