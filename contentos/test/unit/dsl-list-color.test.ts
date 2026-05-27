import { describe, expect, test } from 'vitest';
import {
  fillVarDefaults,
  parseVariablesSchema,
  type VariablesSchema,
  variablesSchemaToZod,
} from '@/lib/visual-templates/dsl';

describe('DSL list', () => {
  const schema = parseVariablesSchema([
    { name: 'steps', label: 'Étapes', type: 'list', minItems: 1, maxItems: 4, itemMax: 40 },
  ]);

  test('valide un tableau de strings', () => {
    const z = variablesSchemaToZod(schema);
    expect(z.parse({ steps: ['a', 'b'] }).steps).toEqual(['a', 'b']);
  });

  test('rejette en dehors des bornes minItems/maxItems', () => {
    const z = variablesSchemaToZod(schema);
    expect(() => z.parse({ steps: [] })).toThrow();
    expect(() => z.parse({ steps: ['a', 'b', 'c', 'd', 'e'] })).toThrow();
  });
});

describe('DSL color', () => {
  const schema = parseVariablesSchema([
    { name: 'accent', label: 'Accent', type: 'color', default: '#ff0000' },
  ]);

  test('accepte un hex valide, rejette un invalide', () => {
    const z = variablesSchemaToZod(schema);
    expect(z.parse({ accent: '#00ff00' }).accent).toBe('#00ff00');
    expect(() => z.parse({ accent: 'red' })).toThrow();
  });

  test('color est optionnel à la validation', () => {
    const z = variablesSchemaToZod(schema);
    expect(z.parse({}).accent).toBeUndefined();
  });
});

describe('fillVarDefaults', () => {
  const schema: VariablesSchema = parseVariablesSchema([
    { name: 'titre', label: 'Titre', type: 'string', max: 50 },
    { name: 'steps', label: 'Étapes', type: 'list' },
    { name: 'accent', label: 'Accent', type: 'color', default: '#123456' },
    { name: 'photo', label: 'Photo', type: 'image' },
  ]);

  test('remplit chaque type avec son défaut', () => {
    const ctx = fillVarDefaults(schema, {});
    expect(ctx.titre).toBe('');
    expect(ctx.steps).toEqual([]);
    expect(ctx.accent).toBe('#123456');
    expect(ctx.photo).toBe('');
  });

  test('color sans défaut → #000000', () => {
    const s = parseVariablesSchema([{ name: 'c', label: 'C', type: 'color' }]);
    expect(fillVarDefaults(s, {}).c).toBe('#000000');
  });

  test('ne remplace pas une valeur fournie', () => {
    const ctx = fillVarDefaults(schema, { titre: 'Salut', steps: ['x'] });
    expect(ctx.titre).toBe('Salut');
    expect(ctx.steps).toEqual(['x']);
  });
});
