import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getBrand, upsertBrand } from '@/lib/media/brand';
import { editImage, generateImage } from '@/lib/media/gemini';
import { aggregatePdf } from '@/lib/media/pdf';
import { renderHtml } from '@/lib/media/render';
import { deleteMediaRow, getMediaRecord, listMediaRecords } from '@/lib/media/repository';
import { deleteObject, getImageBytes } from '@/lib/media/storage';
import { store } from '@/lib/media/store';
import {
  createGuide,
  deleteGuide,
  getGuide,
  listGuides,
  updateGuide,
} from '@/lib/media/style-guides';
import {
  composePrompt,
  createStyle,
  deleteStyle,
  getStyle,
  listStyles,
  updateStyle,
} from '@/lib/media/styles';
import { variableSpecSchema } from '@/lib/media/templates/dsl';
import { renderTemplate } from '@/lib/media/templates/render';
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from '@/lib/media/templates/repository';
import type { MediaSource } from '@/lib/media/types';
import { handle } from '../register';

const variablesSchemaDescription =
  'Schéma des variables du template (tableau d’objets { name, label, type }). ' +
  'Types : string (texte, champ `max` requis), image (id d’une image de la galerie), ' +
  'list (tableau de chaînes, rendu via {{#each}}), color (couleur hex #rrggbb). ' +
  'Les noms doivent être uniques. Référencés dans body_html/css en Handlebars ({{name}}). ' +
  'Le contexte expose aussi {{brand.name}}, {{brand.signature}}, {{brand.logo}}.';

// Outils MCP du moteur média (in-app). Le userId est fourni par le token de la
// session (passerelle MCP centrale → authInfo.extra.userId), comme les autres tools.
export function registerMediaEngineTools(server: McpServer): void {
  // ── Images ─────────────────────────────────────────────────────────────────
  server.registerTool(
    'generate_image',
    {
      title: 'Générer une image',
      description: 'Génère une image à partir d’un prompt texte (Gemini). Retourne l’URL publique.',
      inputSchema: {
        prompt: z
          .string()
          .min(1)
          .describe('Description détaillée : sujet, style, composition, couleurs, ambiance.'),
        aspect_ratio: z
          .enum(['1:1', '16:9', '9:16', '4:3'])
          .optional()
          .describe('Ratio. Défaut 1:1. 16:9 paysage, 9:16 portrait/story, 4:3 classique.'),
        tags: z.array(z.string()).optional().describe('Étiquettes libres pour retrouver l’image.'),
        style_id: z
          .string()
          .optional()
          .describe('id d’un style visuel (list_visual_styles) appliqué en suffixe.'),
      },
    },
    (input, extra) =>
      handle(extra, async (userId) => {
        const st = input.style_id ? await getStyle(userId, input.style_id as string) : undefined;
        const finalPrompt = composePrompt(input.prompt as string, st?.prompt);
        const { bytes, mimeType } = await generateImage(
          finalPrompt,
          (input.aspect_ratio as string) ?? '1:1',
        );
        const rec = await store({
          userId,
          bytes,
          mimeType,
          kind: 'image',
          prompt: finalPrompt,
          parent_id: null,
          source: 'gemini_generate',
          tags: (input.tags as string[]) ?? [],
          style_id: (input.style_id as string) ?? null,
        });
        return { id: rec.id, url: rec.url, width: rec.width, height: rec.height };
      }),
  );

  server.registerTool(
    'edit_image',
    {
      title: 'Éditer une image',
      description:
        'Édite une image existante (par son id) avec un prompt, via Gemini. Crée une variante liée à la source.',
      inputSchema: {
        image_id: z.string().min(1).describe('id de l’image source.'),
        edit_prompt: z.string().min(1).describe('Modification en langage naturel.'),
        tags: z.array(z.string()).optional().describe('Étiquettes libres.'),
      },
    },
    (input, extra) =>
      handle(extra, async (userId) => {
        const source = await getMediaRecord(userId, input.image_id as string);
        if (!source) throw new Error(`Image introuvable: ${input.image_id}`);
        const src = await getImageBytes(source.r2_key);
        if (!src) throw new Error(`Fichier source absent du bucket: ${source.r2_key}`);
        const { bytes, mimeType } = await editImage(
          src.bytes,
          src.contentType,
          input.edit_prompt as string,
        );
        const rec = await store({
          userId,
          bytes,
          mimeType,
          kind: 'image',
          prompt: input.edit_prompt as string,
          parent_id: source.id,
          source: 'gemini_edit',
          tags: (input.tags as string[]) ?? [],
        });
        return { id: rec.id, url: rec.url, parent_id: rec.parent_id };
      }),
  );

  server.registerTool(
    'render_html',
    {
      title: 'Rendre un HTML en image',
      description:
        'Rend un HTML autonome en image aux dimensions données (Chromium partagé). L’agent fournit tout le HTML/CSS.',
      inputSchema: {
        html: z.string().min(1).describe('HTML complet et autonome (CSS inline ou via CDN).'),
        width: z.number().int().positive().describe('Largeur du viewport en pixels.'),
        height: z.number().int().positive().describe('Hauteur du viewport en pixels.'),
        format: z
          .enum(['png', 'webp', 'jpeg'])
          .optional()
          .describe('Format de sortie. Défaut png.'),
        quality: z.number().int().min(1).max(100).optional().describe('Qualité webp/jpeg.'),
        wait_for: z
          .union([z.string(), z.number().int().positive()])
          .optional()
          .describe('Sélecteur CSS à attendre, ou délai ms (max 15000).'),
        tags: z.array(z.string()).optional().describe('Étiquettes libres.'),
      },
    },
    (input, extra) =>
      handle(extra, async (userId) => {
        const { bytes, mimeType } = await renderHtml({
          html: input.html as string,
          width: input.width as number,
          height: input.height as number,
          format: input.format as 'png' | 'webp' | 'jpeg' | undefined,
          quality: input.quality as number | undefined,
          waitFor: input.wait_for as string | number | undefined,
        });
        const rec = await store({
          userId,
          bytes,
          mimeType,
          kind: 'render',
          prompt: null,
          parent_id: null,
          source: 'html_render',
          tags: (input.tags as string[]) ?? [],
          width: input.width as number,
          height: input.height as number,
        });
        return { id: rec.id, url: rec.url, width: rec.width, height: rec.height };
      }),
  );

  server.registerTool(
    'list_images',
    {
      title: 'Lister les médias',
      description:
        'Liste les médias (tri par date décroissante). Filtres : recherche prompt, tags (intersection), source.',
      inputSchema: {
        query: z.string().optional().describe('Recherche texte sur le prompt.'),
        tags: z.array(z.string()).optional().describe('Filtre par tags (intersection).'),
        source: z
          .enum([
            'gemini_generate',
            'gemini_edit',
            'html_render',
            'template_render',
            'upload',
            'pdf_aggregate',
          ])
          .optional()
          .describe('Filtre par origine.'),
        limit: z.number().int().min(1).max(100).optional().describe('Max résultats (défaut 20).'),
      },
    },
    (input, extra) =>
      handle(extra, (userId) =>
        listMediaRecords(userId, {
          query: input.query as string | undefined,
          tags: input.tags as string[] | undefined,
          source: input.source as MediaSource | undefined,
          limit: input.limit as number | undefined,
        }),
      ),
  );

  server.registerTool(
    'get_image',
    {
      title: 'Récupérer un média',
      description: 'Récupère les métadonnées d’un média par son id (null si inconnu).',
      inputSchema: { image_id: z.string().min(1).describe('id du média.') },
    },
    (input, extra) => handle(extra, (userId) => getMediaRecord(userId, input.image_id as string)),
  );

  server.registerTool(
    'delete_image',
    {
      title: 'Supprimer un média',
      description: 'Supprime un média (objet R2 + ligne Postgres). deleted:false si id inconnu.',
      inputSchema: { image_id: z.string().min(1).describe('id du média à supprimer.') },
    },
    (input, extra) =>
      handle(extra, async (userId) => {
        const rec = await getMediaRecord(userId, input.image_id as string);
        if (!rec) return { deleted: false };
        const deleted = await deleteMediaRow(userId, input.image_id as string);
        if (deleted) await deleteObject(rec.r2_key).catch(() => {});
        return { deleted };
      }),
  );

  // ── PDF ──────────────────────────────────────────────────────────────────────
  server.registerTool(
    'create_pdf',
    {
      title: 'Assembler un PDF',
      description:
        'Assemble des images existantes en un PDF, une image par page (carrousel/document LinkedIn).',
      inputSchema: {
        image_ids: z.array(z.string()).min(1).describe('ids d’images dans l’ordre des pages.'),
      },
    },
    (input, extra) =>
      handle(extra, async (userId) => {
        const rec = await aggregatePdf(userId, input.image_ids as string[]);
        return { id: rec.id, url: rec.url };
      }),
  );

  // ── Marque ─────────────────────────────────────────────────────────────────
  server.registerTool(
    'get_brand',
    {
      title: 'Récupérer la marque',
      description:
        'Récupère l’identité de la marque (nom, signature, logo) injectée dans les templates ({{brand.*}}).',
      inputSchema: {},
    },
    (_input, extra) =>
      handle(
        extra,
        async (userId) => (await getBrand(userId)) ?? { name: '', signature: '', logoUrl: null },
      ),
  );

  server.registerTool(
    'update_brand',
    {
      title: 'Mettre à jour la marque',
      description: 'Met à jour l’identité de la marque. Seuls les champs fournis sont modifiés.',
      inputSchema: {
        name: z.string().optional().describe('Nom de la marque.'),
        signature: z.string().optional().describe('Ligne de signature.'),
        logo_url: z.string().optional().describe('URL publique du logo.'),
      },
    },
    (input, extra) =>
      handle(extra, async (userId) => {
        const current = await getBrand(userId);
        return upsertBrand(userId, {
          name: input.name !== undefined ? (input.name as string) : (current?.name ?? ''),
          signature:
            input.signature !== undefined
              ? (input.signature as string)
              : (current?.signature ?? ''),
          logoUrl:
            input.logo_url !== undefined ? (input.logo_url as string) : (current?.logoUrl ?? null),
        });
      }),
  );

  // ── Styles ─────────────────────────────────────────────────────────────────
  server.registerTool(
    'list_visual_styles',
    {
      title: 'Lister les styles visuels',
      description: 'Liste les styles visuels (suffixes de prompt réutilisables).',
      inputSchema: {},
    },
    (_input, extra) => handle(extra, (userId) => listStyles(userId)),
  );

  server.registerTool(
    'create_visual_style',
    {
      title: 'Créer un style visuel',
      description: 'Crée un style visuel (nom + prompt ajouté en suffixe à la génération).',
      inputSchema: {
        name: z.string().min(1).describe('Nom court du style.'),
        prompt: z.string().min(1).describe('Texte ajouté en suffixe (esthétique, matière, etc.).'),
      },
    },
    (input, extra) =>
      handle(extra, (userId) =>
        createStyle(userId, { name: input.name as string, prompt: input.prompt as string }),
      ),
  );

  server.registerTool(
    'update_visual_style',
    {
      title: 'Modifier un style visuel',
      description: 'Met à jour le nom et/ou le prompt d’un style.',
      inputSchema: {
        style_id: z.string().min(1).describe('id du style.'),
        name: z.string().optional(),
        prompt: z.string().optional(),
      },
    },
    (input, extra) =>
      handle(extra, async (userId) => {
        const row = await updateStyle(userId, input.style_id as string, {
          ...(input.name !== undefined ? { name: input.name as string } : {}),
          ...(input.prompt !== undefined ? { prompt: input.prompt as string } : {}),
        });
        if (!row) throw new Error(`Style introuvable: ${input.style_id}`);
        return row;
      }),
  );

  server.registerTool(
    'delete_visual_style',
    {
      title: 'Supprimer un style visuel',
      description: 'Supprime un style. Les images déjà générées ne sont pas affectées.',
      inputSchema: { style_id: z.string().min(1).describe('id du style.') },
    },
    (input, extra) =>
      handle(extra, async (userId) => {
        await deleteStyle(userId, input.style_id as string);
        return { deleted: true };
      }),
  );

  // ── Chartes ──────────────────────────────────────────────────────────────────
  server.registerTool(
    'list_style_guides',
    {
      title: 'Lister les chartes',
      description: 'Liste les chartes graphiques (références markdown rattachables aux templates).',
      inputSchema: {},
    },
    (_input, extra) => handle(extra, (userId) => listGuides(userId)),
  );

  server.registerTool(
    'get_style_guide',
    {
      title: 'Récupérer une charte',
      description: 'Récupère le contenu complet d’une charte par son id.',
      inputSchema: { guide_id: z.string().min(1).describe('id de la charte.') },
    },
    (input, extra) =>
      handle(extra, async (userId) => {
        const guide = await getGuide(userId, input.guide_id as string);
        if (!guide) throw new Error(`Charte introuvable: ${input.guide_id}`);
        return guide;
      }),
  );

  server.registerTool(
    'create_style_guide',
    {
      title: 'Créer une charte',
      description: 'Crée une charte graphique (nom + contenu markdown).',
      inputSchema: {
        name: z.string().min(1).describe('Nom court de la charte.'),
        content: z.string().describe('Contenu markdown : palette, typographies, règles.'),
      },
    },
    (input, extra) =>
      handle(extra, (userId) =>
        createGuide(userId, {
          name: input.name as string,
          content: (input.content as string) ?? '',
        }),
      ),
  );

  server.registerTool(
    'update_style_guide',
    {
      title: 'Modifier une charte',
      description: 'Met à jour le nom et/ou le contenu d’une charte.',
      inputSchema: {
        guide_id: z.string().min(1).describe('id de la charte.'),
        name: z.string().optional(),
        content: z.string().optional(),
      },
    },
    (input, extra) =>
      handle(extra, async (userId) => {
        const row = await updateGuide(userId, input.guide_id as string, {
          ...(input.name !== undefined ? { name: input.name as string } : {}),
          ...(input.content !== undefined ? { content: input.content as string } : {}),
        });
        if (!row) throw new Error(`Charte introuvable: ${input.guide_id}`);
        return row;
      }),
  );

  server.registerTool(
    'delete_style_guide',
    {
      title: 'Supprimer une charte',
      description: 'Supprime une charte. Les templates liés voient leur référence mise à null.',
      inputSchema: { guide_id: z.string().min(1).describe('id de la charte.') },
    },
    (input, extra) =>
      handle(extra, async (userId) => {
        await deleteGuide(userId, input.guide_id as string);
        return { deleted: true };
      }),
  );

  // ── Templates ────────────────────────────────────────────────────────────────
  server.registerTool(
    'list_visual_templates',
    {
      title: 'Lister les templates visuels',
      description:
        'Liste les templates visuels (body_html + css Handlebars, variables_schema typé). Filtre optionnel par charte.',
      inputSchema: {
        style_guide_id: z
          .string()
          .optional()
          .describe('Filtre : templates rattachés à cette charte.'),
      },
    },
    (input, extra) =>
      handle(extra, (userId) =>
        listTemplates(
          userId,
          input.style_guide_id ? { styleGuideId: input.style_guide_id as string } : {},
        ),
      ),
  );

  server.registerTool(
    'get_visual_template',
    {
      title: 'Récupérer un template visuel',
      description: 'Récupère un template par son id (variables_schema + sample_vars).',
      inputSchema: { template_id: z.string().min(1).describe('id du template.') },
    },
    (input, extra) =>
      handle(extra, async (userId) => {
        const tpl = await getTemplate(userId, input.template_id as string);
        if (!tpl) throw new Error(`Template introuvable: ${input.template_id}`);
        return tpl;
      }),
  );

  server.registerTool(
    'create_visual_template',
    {
      title: 'Créer un template visuel',
      description:
        'Crée un template : body_html + css Handlebars, variables_schema typé, sample_vars. {{brand.*}} disponible.',
      inputSchema: {
        slug: z.string().min(1).describe('Slug unique du template.'),
        label: z.string().min(1).describe('Nom lisible.'),
        platform: z.string().optional().describe('Plateforme cible (défaut linkedin).'),
        width: z.number().int().positive().describe('Largeur px.'),
        height: z.number().int().positive().describe('Hauteur px.'),
        body_html: z.string().min(1).describe('Corps HTML Handlebars.'),
        css: z.string().optional().describe('CSS Handlebars.'),
        variables_schema: z
          .array(variableSpecSchema)
          .default([])
          .describe(variablesSchemaDescription),
        sample_vars: z.record(z.string(), z.unknown()).default({}).describe('Valeurs d’exemple.'),
        style_guide_id: z.string().nullable().optional().describe('Charte à rattacher.'),
      },
    },
    (input, extra) =>
      handle(extra, (userId) =>
        createTemplate(userId, {
          slug: input.slug as string,
          label: input.label as string,
          platform: input.platform as string | undefined,
          width: input.width as number,
          height: input.height as number,
          bodyHtml: input.body_html as string,
          css: input.css as string | undefined,
          variablesSchema: input.variables_schema as unknown[],
          sampleVars: input.sample_vars as Record<string, unknown>,
          styleGuideId: (input.style_guide_id as string | null | undefined) ?? null,
        }),
      ),
  );

  server.registerTool(
    'update_visual_template',
    {
      title: 'Modifier un template visuel',
      description: 'Met à jour un template (champs fournis uniquement).',
      inputSchema: {
        template_id: z.string().min(1).describe('id du template.'),
        slug: z.string().min(1).optional(),
        label: z.string().min(1).optional(),
        platform: z.string().optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        body_html: z.string().min(1).optional(),
        css: z.string().optional(),
        variables_schema: z
          .array(variableSpecSchema)
          .optional()
          .describe(variablesSchemaDescription),
        sample_vars: z.record(z.string(), z.unknown()).optional(),
        style_guide_id: z.string().nullable().optional(),
      },
    },
    (input, extra) =>
      handle(extra, async (userId) => {
        const patch = {
          ...(input.slug !== undefined ? { slug: input.slug as string } : {}),
          ...(input.label !== undefined ? { label: input.label as string } : {}),
          ...(input.platform !== undefined ? { platform: input.platform as string } : {}),
          ...(input.width !== undefined ? { width: input.width as number } : {}),
          ...(input.height !== undefined ? { height: input.height as number } : {}),
          ...(input.body_html !== undefined ? { bodyHtml: input.body_html as string } : {}),
          ...(input.css !== undefined ? { css: input.css as string } : {}),
          ...(input.variables_schema !== undefined
            ? { variablesSchema: input.variables_schema as unknown[] }
            : {}),
          ...(input.sample_vars !== undefined
            ? { sampleVars: input.sample_vars as Record<string, unknown> }
            : {}),
          ...(input.style_guide_id !== undefined
            ? { styleGuideId: input.style_guide_id as string | null }
            : {}),
        };
        const row = await updateTemplate(userId, input.template_id as string, patch);
        if (!row) throw new Error(`Template introuvable: ${input.template_id}`);
        return row;
      }),
  );

  server.registerTool(
    'delete_visual_template',
    {
      title: 'Supprimer un template visuel',
      description: 'Supprime un template. Les images déjà rendues ne sont pas affectées.',
      inputSchema: { template_id: z.string().min(1).describe('id du template.') },
    },
    (input, extra) =>
      handle(extra, async (userId) => {
        await deleteTemplate(userId, input.template_id as string);
        return { deleted: true };
      }),
  );

  server.registerTool(
    'render_template',
    {
      title: 'Rendre un template visuel',
      description:
        'Compile un template (variables + marque) puis capture via Chromium. Retourne l’id et l’URL publique.',
      inputSchema: {
        template_id: z.string().min(1).describe('id du template.'),
        vars: z
          .record(z.string(), z.unknown())
          .default({})
          .describe('Valeurs des variables, validées contre le variables_schema.'),
      },
    },
    (input, extra) =>
      handle(extra, async (userId) => {
        const rec = await renderTemplate(
          userId,
          input.template_id as string,
          (input.vars as Record<string, unknown>) ?? {},
        );
        return { id: rec.id, url: rec.url, width: rec.width, height: rec.height };
      }),
  );
}
