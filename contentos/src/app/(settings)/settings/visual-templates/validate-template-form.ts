import Handlebars from 'handlebars';
import { z } from 'zod';
import { parseVariablesSchema, variablesSchemaToZod } from '@/lib/visual-templates/dsl';

export const templateFormSchema = z.object({
  label: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  platform: z.enum(['linkedin']),
  width: z.coerce.number().int().min(1).max(10_000),
  height: z.coerce.number().int().min(1).max(10_000),
  bodyHtml: z.string().min(1).max(50_000),
  css: z.string().max(50_000),
  variablesSchemaRaw: z.string(),
  sampleVarsRaw: z.string(),
});

export type TemplateFormParsed = {
  label: string;
  slug: string;
  platform: string;
  width: number;
  height: number;
  bodyHtml: string;
  css: string;
  variablesSchema: unknown;
  sampleVars: unknown;
};

type Result =
  | { ok: true; data: TemplateFormParsed }
  | { ok: false; fieldErrors: Record<string, string>; message: string };

export function readFormFields(formData: FormData) {
  return {
    label: String(formData.get('label') ?? ''),
    slug: String(formData.get('slug') ?? ''),
    platform: String(formData.get('platform') ?? ''),
    width: String(formData.get('width') ?? ''),
    height: String(formData.get('height') ?? ''),
    bodyHtml: String(formData.get('bodyHtml') ?? ''),
    css: String(formData.get('css') ?? ''),
    variablesSchemaRaw: String(formData.get('variablesSchema') ?? '[]'),
    sampleVarsRaw: String(formData.get('sampleVars') ?? '{}'),
  };
}

function tryParseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

export function validateTemplateForm(formData: FormData): Result {
  const raw = readFormFields(formData);

  const base = templateFormSchema.safeParse(raw);
  if (!base.success) {
    const fe: Record<string, string> = {};
    for (const issue of base.error.issues) {
      const k = String(issue.path[0] ?? '');
      if (k && !fe[k]) fe[k] = issue.message;
    }
    return { ok: false, fieldErrors: fe, message: 'validation' };
  }

  if (base.data.css.includes('<') || base.data.css.toLowerCase().includes('</style>')) {
    return {
      ok: false,
      fieldErrors: { css: 'Le CSS ne doit pas contenir < ni </style>.' },
      message: 'validation',
    };
  }

  const parsedSchema = tryParseJson(base.data.variablesSchemaRaw);
  if (!parsedSchema.ok) {
    return {
      ok: false,
      fieldErrors: { variablesSchema: 'JSON invalide.' },
      message: 'validation',
    };
  }
  let schema: ReturnType<typeof parseVariablesSchema>;
  try {
    schema = parseVariablesSchema(parsedSchema.value);
  } catch (e) {
    return {
      ok: false,
      fieldErrors: { variablesSchema: (e as Error).message },
      message: 'validation',
    };
  }

  const parsedSample = tryParseJson(base.data.sampleVarsRaw);
  if (!parsedSample.ok) {
    return {
      ok: false,
      fieldErrors: { sampleVars: 'JSON invalide.' },
      message: 'validation',
    };
  }
  try {
    // Les sample_vars n'ont pas à fournir d'image (le preview utilise un
    // placeholder) — on valide donc avec imagesOptional.
    variablesSchemaToZod(schema, { imagesOptional: true }).parse(parsedSample.value);
  } catch (e) {
    return {
      ok: false,
      fieldErrors: { sampleVars: `Ne respecte pas le schéma : ${(e as Error).message}` },
      message: 'validation',
    };
  }

  try {
    Handlebars.compile(base.data.bodyHtml, { strict: true });
  } catch (e) {
    return {
      ok: false,
      fieldErrors: { bodyHtml: (e as Error).message },
      message: 'validation',
    };
  }
  try {
    Handlebars.compile(base.data.css, { strict: true });
  } catch (e) {
    return {
      ok: false,
      fieldErrors: { css: (e as Error).message },
      message: 'validation',
    };
  }

  return {
    ok: true,
    data: {
      label: base.data.label,
      slug: base.data.slug,
      platform: base.data.platform,
      width: base.data.width,
      height: base.data.height,
      bodyHtml: base.data.bodyHtml,
      css: base.data.css,
      variablesSchema: schema,
      sampleVars: parsedSample.value,
    },
  };
}
