import { z } from 'zod';

export const moduleContentSchemas = {
  markdown: z.object({ md: z.string() }),
  callout: z.object({ variant: z.enum(['info', 'warn', 'success']), md: z.string() }),
  image: z.object({
    url: z.string().url(),
    alt: z.string().optional(),
    caption: z.string().optional(),
  }),
  video: z.object({ url: z.string().url(), caption: z.string().optional() }),
  file: z.object({
    url: z.string().url(),
    label: z.string(),
    filename: z.string(),
    size: z.number().optional(),
  }),
  embed: z.object({ url: z.string().url() }),
  code: z.object({ language: z.string(), code: z.string(), filename: z.string().optional() }),
  prompt: z.object({ prompt: z.string(), title: z.string().optional() }),
  accordion: z.object({ title: z.string(), md: z.string(), open: z.boolean().optional() }),
  steps: z.object({ steps: z.array(z.object({ title: z.string(), md: z.string() })).min(1) }),
  comparison: z.object({
    columns: z
      .array(z.object({ title: z.string(), md: z.string() }))
      .min(2)
      .max(3),
  }),
  quote: z.object({
    text: z.string(),
    author: z.string().optional(),
    source: z.string().optional(),
    url: z.string().url().optional(),
  }),
  cta: z.object({
    label: z.string(),
    url: z.string().url(),
    variant: z.enum(['primary', 'secondary']).optional(),
  }),
  gallery: z.object({
    images: z
      .array(
        z.object({
          url: z.string().url(),
          alt: z.string().optional(),
          caption: z.string().optional(),
        }),
      )
      .min(1),
  }),
} as const;

export type ModuleType = keyof typeof moduleContentSchemas;

export type ModuleContent = {
  [K in ModuleType]: { type: K; content: z.infer<(typeof moduleContentSchemas)[K]> };
}[ModuleType];

export type ParsedModule = ModuleContent & { id: string; position: number };

type RawModule = { id: string; type: string; position: number; content: unknown };

export function parseModule(row: RawModule): ParsedModule | null {
  const schema = moduleContentSchemas[row.type as ModuleType];
  if (!schema) return null;
  const parsed = schema.safeParse(row.content);
  if (!parsed.success) return null;
  return {
    id: row.id,
    type: row.type,
    position: row.position,
    content: parsed.data,
  } as ParsedModule;
}
