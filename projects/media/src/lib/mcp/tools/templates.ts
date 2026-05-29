import { z } from "zod";
import { jsonResult, errorResult } from "@/lib/mcp/result";
import { variableSpecSchema } from "@/lib/templates/dsl";
import {
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
} from "@/lib/templates/repository";
import { renderTemplate } from "@/lib/templates/render";
import type { ToolDef } from "../types";

const variablesSchemaDescription =
  "Schéma des variables du template (tableau d'objets { name, label, type }). " +
  "Types : string (texte, champ `max` requis), image (id d'une image de la galerie), " +
  "list (tableau de chaînes, rendu via {{#each}}), color (couleur hex #rrggbb). " +
  "Les noms doivent être uniques. Référencés dans body_html/css en Handlebars ({{name}}). " +
  "Le contexte expose aussi {{brand.name}}, {{brand.signature}}, {{brand.logo}}.";

export const templateTools: ToolDef[] = [
  {
    name: "list_visual_templates",
    description:
      "Liste les templates visuels (tri par date décroissante). Un template est un visuel " +
      "réutilisable : body_html + css en Handlebars, un variables_schema typé, et l'accès à {{brand.*}}. " +
      "Filtre optionnel par charte (style_guide_id).",
    inputSchema: {
      style_guide_id: z
        .string()
        .optional()
        .describe("Filtre : ne renvoie que les templates rattachés à cette charte."),
    },
    handler: async (userId, args) => {
      const { style_guide_id } = args as { style_guide_id?: string };
      return jsonResult(
        await listTemplates(userId, style_guide_id ? { styleGuideId: style_guide_id } : {}),
      );
    },
  },
  {
    name: "get_visual_template",
    description:
      "Récupère un template visuel par son id (avec son variables_schema et ses sample_vars).",
    inputSchema: {
      template_id: z.string().min(1).describe("id du template à récupérer."),
    },
    handler: async (userId, args) => {
      const { template_id } = args as { template_id: string };
      const tpl = await getTemplate(userId, template_id);
      if (!tpl) return errorResult(`Template introuvable: ${template_id}`);
      return jsonResult(tpl);
    },
  },
  {
    name: "create_visual_template",
    description:
      "Crée un template visuel : body_html + css en Handlebars, variables_schema typé, sample_vars. " +
      "Les variables se réfèrent via {{name}} ; {{brand.name}}, {{brand.signature}}, {{brand.logo}} sont disponibles. " +
      "Helpers : {{escape x}}, {{trim x}}, {{#ifNotEmpty x}}…{{/ifNotEmpty}}, {{#each liste}}…{{/each}}.",
    inputSchema: {
      slug: z.string().min(1).describe("Identifiant court unique du template (ex. « post-citation »)."),
      label: z.string().min(1).describe("Nom lisible du template."),
      platform: z
        .string()
        .optional()
        .describe("Plateforme cible (ex. « linkedin », « instagram »). Défaut linkedin."),
      width: z.number().int().positive().describe("Largeur du visuel en pixels."),
      height: z.number().int().positive().describe("Hauteur du visuel en pixels."),
      body_html: z
        .string()
        .min(1)
        .describe("Corps HTML en Handlebars. Variables via {{name}}, marque via {{brand.*}}."),
      css: z.string().optional().describe("CSS en Handlebars (peut référencer des variables). Défaut vide."),
      variables_schema: z
        .array(variableSpecSchema)
        .default([])
        .describe(variablesSchemaDescription),
      sample_vars: z
        .record(z.string(), z.unknown())
        .default({})
        .describe("Valeurs d'exemple des variables (pour l'aperçu)."),
      style_guide_id: z
        .string()
        .nullable()
        .optional()
        .describe("id d'une charte (style guide) à rattacher au template."),
    },
    handler: async (userId, args) => {
      const { slug, label, platform, width, height, body_html, css, variables_schema, sample_vars, style_guide_id } = args as {
        slug: string; label: string; platform?: string; width: number; height: number;
        body_html: string; css?: string; variables_schema: unknown[]; sample_vars: Record<string, unknown>; style_guide_id?: string | null;
      };
      const row = await createTemplate(userId, {
        slug,
        label,
        platform,
        width,
        height,
        bodyHtml: body_html,
        css,
        variablesSchema: variables_schema as never,
        sampleVars: sample_vars,
        styleGuideId: style_guide_id ?? null,
      });
      return jsonResult(row);
    },
  },
  {
    name: "update_visual_template",
    description: "Met à jour un template visuel existant (champs fournis uniquement).",
    inputSchema: {
      template_id: z.string().min(1).describe("id du template à modifier."),
      slug: z.string().min(1).optional().describe("Nouvel identifiant court unique."),
      label: z.string().min(1).optional().describe("Nouveau nom lisible."),
      platform: z.string().optional().describe("Nouvelle plateforme cible."),
      width: z.number().int().positive().optional().describe("Nouvelle largeur en pixels."),
      height: z.number().int().positive().optional().describe("Nouvelle hauteur en pixels."),
      body_html: z.string().min(1).optional().describe("Nouveau corps HTML Handlebars."),
      css: z.string().optional().describe("Nouveau CSS Handlebars."),
      variables_schema: z
        .array(variableSpecSchema)
        .optional()
        .describe(variablesSchemaDescription),
      sample_vars: z.record(z.string(), z.unknown()).optional().describe("Nouvelles valeurs d'exemple."),
      style_guide_id: z.string().nullable().optional().describe("Nouvelle charte rattachée (null pour détacher)."),
    },
    handler: async (userId, args) => {
      const { template_id, slug, label, platform, width, height, body_html, css, variables_schema, sample_vars, style_guide_id } = args as {
        template_id: string; slug?: string; label?: string; platform?: string; width?: number; height?: number;
        body_html?: string; css?: string; variables_schema?: unknown[]; sample_vars?: Record<string, unknown>; style_guide_id?: string | null;
      };
      const patch = {
        ...(slug !== undefined ? { slug } : {}),
        ...(label !== undefined ? { label } : {}),
        ...(platform !== undefined ? { platform } : {}),
        ...(width !== undefined ? { width } : {}),
        ...(height !== undefined ? { height } : {}),
        ...(body_html !== undefined ? { bodyHtml: body_html } : {}),
        ...(css !== undefined ? { css } : {}),
        ...(variables_schema !== undefined ? { variablesSchema: variables_schema as never } : {}),
        ...(sample_vars !== undefined ? { sampleVars: sample_vars } : {}),
        ...(style_guide_id !== undefined ? { styleGuideId: style_guide_id } : {}),
      };
      const row = await updateTemplate(userId, template_id, patch);
      if (!row) return errorResult(`Template introuvable: ${template_id}`);
      return jsonResult(row);
    },
  },
  {
    name: "delete_visual_template",
    description: "Supprime définitivement un template visuel. Les images déjà rendues ne sont pas affectées.",
    inputSchema: {
      template_id: z.string().min(1).describe("id du template à supprimer."),
    },
    handler: async (userId, args) => {
      const { template_id } = args as { template_id: string };
      await deleteTemplate(userId, template_id);
      return jsonResult({ deleted: true });
    },
  },
  {
    name: "render_template",
    description:
      "Rend un template visuel en image : compile body_html + css avec les variables fournies et la marque, " +
      "puis capture via le Chromium partagé. Retourne l'id et l'URL publique de l'image (réutilisable telle quelle).",
    inputSchema: {
      template_id: z.string().min(1).describe("id du template à rendre (issu de list_visual_templates)."),
      vars: z
        .record(z.string(), z.unknown())
        .default({})
        .describe("Valeurs des variables du template, par nom. Validées contre le variables_schema."),
    },
    handler: async (userId, args) => {
      const { template_id, vars } = args as { template_id: string; vars: Record<string, unknown> };
      const rec = await renderTemplate(userId, template_id, vars);
      return jsonResult({ id: rec.id, url: rec.url, width: rec.width, height: rec.height });
    },
  },
];
