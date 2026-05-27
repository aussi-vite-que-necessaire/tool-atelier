import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createVisualStyle,
  deleteVisualStyle,
  listVisualStyles,
  updateVisualStyle,
} from '@/lib/db/repositories/visual-styles';
import {
  createVisualTemplate,
  deleteVisualTemplate,
  getVisualTemplate,
  listVisualTemplates,
  updateVisualTemplate,
} from '@/lib/db/repositories/visual-templates';
import { parseVariablesSchema, variableSpecSchema } from '@/lib/visual-templates/dsl';
import { handle } from '../register';

// Schéma d'entrée des variables = schéma canonique du DSL (string | image | list | color).
export const variableSpecInput = variableSpecSchema;

const variablesSchemaDescription =
  'Liste de variables du template. Types : string (texte, champ `max` requis), ' +
  'image (mediaId d’une image de la galerie), list (tableau de chaînes, rendu via {{#each}}), ' +
  'color (couleur hex #rrggbb).';

type TemplateInput = {
  slug: string;
  label: string;
  platform?: string;
  width: number;
  height: number;
  bodyHtml: string;
  css: string;
  variablesSchema: unknown;
  sampleVars: Record<string, unknown>;
  styleGuideId?: string | null;
};

export const visualImpl = {
  listTemplates: (userId: string) => listVisualTemplates(userId),
  getTemplate: async (userId: string, input: { id: string }) => {
    const t = await getVisualTemplate(userId, input.id);
    if (!t) throw new Error('Template visuel introuvable');
    return { ...t, variableSpecs: parseVariablesSchema(t.variablesSchema) };
  },
  createTemplate: async (userId: string, input: TemplateInput) => {
    parseVariablesSchema(input.variablesSchema); // valide le schéma (throw si mal formé)
    return createVisualTemplate(userId, {
      slug: input.slug,
      label: input.label,
      platform: input.platform ?? 'linkedin',
      width: input.width,
      height: input.height,
      bodyHtml: input.bodyHtml,
      css: input.css,
      variablesSchema: input.variablesSchema,
      sampleVars: input.sampleVars,
      styleGuideId: input.styleGuideId ?? null,
    });
  },
  updateTemplate: async (
    userId: string,
    input: { id: string } & Partial<Omit<TemplateInput, 'slug'>> & { slug?: string },
  ) => {
    if (input.variablesSchema !== undefined) parseVariablesSchema(input.variablesSchema);
    const { id, ...patch } = input;
    return updateVisualTemplate(userId, id, patch);
  },
  deleteTemplate: async (userId: string, input: { id: string }) => {
    await deleteVisualTemplate(userId, input.id);
    return { deleted: input.id };
  },
  listStyles: (userId: string) => listVisualStyles(userId),
  createStyle: (userId: string, input: { name: string; prompt: string }) =>
    createVisualStyle(userId, input),
  updateStyle: (userId: string, input: { id: string; name?: string; prompt?: string }) =>
    updateVisualStyle(userId, input.id, { name: input.name, prompt: input.prompt }),
  deleteStyle: async (userId: string, input: { id: string }) => {
    await deleteVisualStyle(userId, input.id);
    return { deleted: input.id };
  },
};

export function registerVisualTools(server: McpServer): void {
  server.registerTool(
    'list_visual_templates',
    { title: 'Lister les templates visuels', description: 'Templates visuels.', inputSchema: {} },
    (_i, extra) => handle(extra, (u) => visualImpl.listTemplates(u)),
  );
  server.registerTool(
    'get_visual_template',
    {
      title: 'Détails d’un template visuel',
      description:
        'Renvoie un template + ses specs de variables parsées (params à remplir) + sampleVars.',
      inputSchema: { id: z.string() },
    },
    (input, extra) => handle(extra, (u) => visualImpl.getTemplate(u, input)),
  );
  server.registerTool(
    'create_visual_template',
    {
      title: 'Créer un template visuel',
      description: 'Crée un template visuel (HTML + CSS + schéma de variables + sampleVars).',
      inputSchema: {
        slug: z.string(),
        label: z.string(),
        platform: z.string().optional(),
        width: z.number().int(),
        height: z.number().int(),
        bodyHtml: z.string(),
        css: z.string(),
        variablesSchema: z.array(variableSpecInput).describe(variablesSchemaDescription),
        sampleVars: z.record(z.string(), z.unknown()),
        styleGuideId: z.string().nullable().optional(),
      },
    },
    (input, extra) => handle(extra, (u) => visualImpl.createTemplate(u, input)),
  );
  server.registerTool(
    'update_visual_template',
    {
      title: 'Modifier un template visuel',
      description: 'Met à jour un template visuel.',
      inputSchema: {
        id: z.string(),
        slug: z.string().optional(),
        label: z.string().optional(),
        platform: z.string().optional(),
        width: z.number().int().optional(),
        height: z.number().int().optional(),
        bodyHtml: z.string().optional(),
        css: z.string().optional(),
        variablesSchema: z.array(variableSpecInput).describe(variablesSchemaDescription).optional(),
        sampleVars: z.record(z.string(), z.unknown()).optional(),
        styleGuideId: z.string().nullable().optional(),
      },
    },
    (input, extra) => handle(extra, (u) => visualImpl.updateTemplate(u, input)),
  );
  server.registerTool(
    'delete_visual_template',
    {
      title: 'Supprimer un template visuel',
      description: 'Supprime un template visuel.',
      inputSchema: { id: z.string() },
    },
    (input, extra) => handle(extra, (u) => visualImpl.deleteTemplate(u, input)),
  );
  server.registerTool(
    'list_visual_styles',
    { title: 'Lister les styles visuels', description: 'Styles d’image IA.', inputSchema: {} },
    (_i, extra) => handle(extra, (u) => visualImpl.listStyles(u)),
  );
  server.registerTool(
    'create_visual_style',
    {
      title: 'Créer un style visuel',
      description: 'Crée un style d’image IA (name + prompt).',
      inputSchema: { name: z.string(), prompt: z.string() },
    },
    (input, extra) => handle(extra, (u) => visualImpl.createStyle(u, input)),
  );
  server.registerTool(
    'update_visual_style',
    {
      title: 'Modifier un style visuel',
      description: 'Met à jour un style d’image IA.',
      inputSchema: { id: z.string(), name: z.string().optional(), prompt: z.string().optional() },
    },
    (input, extra) => handle(extra, (u) => visualImpl.updateStyle(u, input)),
  );
  server.registerTool(
    'delete_visual_style',
    {
      title: 'Supprimer un style visuel',
      description: 'Supprime un style d’image IA.',
      inputSchema: { id: z.string() },
    },
    (input, extra) => handle(extra, (u) => visualImpl.deleteStyle(u, input)),
  );
}
