import { type ZodObject, type ZodTypeAny, z } from 'zod';

const identifier = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'invalid identifier');

const stringSpec = z.object({
  name: identifier,
  label: z.string().min(1),
  description: z.string().optional(),
  type: z.literal('string'),
  min: z.number().int().nonnegative().optional(),
  max: z.number().int().positive(),
  optional: z.boolean().optional(),
});

const imageSpec = z.object({
  name: identifier,
  label: z.string().min(1),
  description: z.string().optional(),
  type: z.literal('image'),
  optional: z.boolean().optional(),
});

const listSpec = z.object({
  name: identifier,
  label: z.string().min(1),
  description: z.string().optional(),
  type: z.literal('list'),
  itemMin: z.number().int().nonnegative().optional(),
  itemMax: z.number().int().positive().optional(),
  minItems: z.number().int().nonnegative().optional(),
  maxItems: z.number().int().positive().optional(),
  optional: z.boolean().optional(),
});

const colorSpec = z.object({
  name: identifier,
  label: z.string().min(1),
  description: z.string().optional(),
  type: z.literal('color'),
  default: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  optional: z.boolean().optional(),
});

export const variableSpecSchema = z.discriminatedUnion('type', [
  stringSpec,
  imageSpec,
  listSpec,
  colorSpec,
]);

export type VariableSpec = z.infer<typeof variableSpecSchema>;
export type StringVariableSpec = z.infer<typeof stringSpec>;
export type ImageVariableSpec = z.infer<typeof imageSpec>;
export type ListVariableSpec = z.infer<typeof listSpec>;
export type ColorVariableSpec = z.infer<typeof colorSpec>;
export type VariablesSchema = VariableSpec[];

const variablesSchemaMeta = z.array(variableSpecSchema).superRefine((arr, ctx) => {
  const seen = new Set<string>();
  for (const v of arr) {
    if (seen.has(v.name)) {
      ctx.addIssue({ code: 'custom', message: `duplicate variable name: ${v.name}` });
    }
    seen.add(v.name);
  }
});

export function parseVariablesSchema(raw: unknown): VariablesSchema {
  return variablesSchemaMeta.parse(raw);
}

export function variablesSchemaToZod(
  schema: VariablesSchema,
  opts: { imagesOptional?: boolean } = {},
): ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const v of schema) {
    if (v.type === 'string') {
      let s = z.string().trim();
      if (v.min !== undefined) s = s.min(v.min);
      s = s.max(v.max);
      shape[v.name] = v.optional ? s.optional() : s;
    } else if (v.type === 'list') {
      let item = z.string().trim();
      if (v.itemMin !== undefined) item = item.min(v.itemMin);
      if (v.itemMax !== undefined) item = item.max(v.itemMax);
      let arr = z.array(item);
      if (v.minItems !== undefined) arr = arr.min(v.minItems);
      if (v.maxItems !== undefined) arr = arr.max(v.maxItems);
      shape[v.name] = v.optional ? arr.optional() : arr;
    } else if (v.type === 'color') {
      // Color : user-driven, valeur par défaut injectée au rendu → toujours
      // optionnel à la validation.
      shape[v.name] = z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional();
    } else {
      // image : la valeur est un mediaId. En preview (imagesOptional), on
      // n'exige pas d'image — un placeholder est injecté au rendu.
      const s = z.string();
      shape[v.name] = v.optional || opts.imagesOptional ? s.optional() : s.min(1);
    }
  }
  return z.object(shape);
}

// Construit un contexte complet : toute variable du schéma est présente, avec
// un défaut typé si absente. Nécessaire car Handlebars compile en strict mode
// (référencer une variable absente lève, même dans un {{#if}}).
export function fillVarDefaults(
  schema: VariablesSchema,
  vars: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...vars };
  for (const v of schema) {
    if (out[v.name] !== undefined && out[v.name] !== null) continue;
    if (v.type === 'list') out[v.name] = [];
    else if (v.type === 'color') out[v.name] = v.default ?? '#000000';
    else out[v.name] = ''; // string + image
  }
  return out;
}
