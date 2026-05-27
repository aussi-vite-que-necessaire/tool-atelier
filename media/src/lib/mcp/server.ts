import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateImage, editImage } from "@/lib/gemini";
import { renderHtml } from "@/lib/render";
import { getImageBytes, deleteObject } from "@/lib/storage";
import { getMediaRecord, listMediaRecords, deleteMediaRow } from "@/lib/media/repository";
import { store } from "@/lib/store";
import { jsonResult, imageResult } from "./result";
import { registerStyleTools } from "./tools/styles";
import { registerStyleGuideTools } from "./tools/style-guides";
import { registerBrandTools } from "./tools/brand";
import { registerTemplateTools } from "./tools/templates";
import { getStyle } from "@/lib/styles/repository";
import { composePrompt } from "@/lib/styles/compose";

export const INSTRUCTIONS = `Image Studio génère, édite et rend des images pour illustrer documents, posts et présentations.

Workflow :
- generate_image (prompt texte → image) et render_html (HTML/CSS → image) créent une image et renvoient un id court + une URL publique permanente, réutilisable telle quelle (Outline, LinkedIn, slides).
- edit_image part de l'id d'une image existante pour produire une variante (la source est conservée).
- list_images / get_image retrouvent les images par tags, recherche de prompt ou source ; delete_image supprime.

Conventions :
- Réutilise l'URL retournée directement ; ne re-télécharge pas l'image.
- Pose des tags à la création pour pouvoir retrouver les images plus tard.
- Pour render_html, fournis un HTML complet et autonome (polices via <link>, CSS inline ou CDN) : le serveur ne fait aucun templating ni substitution de variables.`;

export function registerAllTools(server: McpServer): void {
  server.registerTool(
    "generate_image",
    {
      description:
        "Génère une image à partir d'un prompt texte (Gemini Nano Banana). Retourne l'URL publique.",
      inputSchema: {
        prompt: z
          .string()
          .min(1)
          .describe("Description détaillée de l'image : sujet, style, composition, couleurs, ambiance."),
        aspect_ratio: z
          .enum(["1:1", "16:9", "9:16", "4:3"])
          .optional()
          .describe("Ratio de l'image. Défaut 1:1. 16:9 paysage, 9:16 portrait/story, 4:3 classique."),
        tags: z
          .array(z.string())
          .optional()
          .describe("Étiquettes libres pour retrouver l'image via list_images, ex: ['linkedin','tech']."),
        style_id: z
          .string()
          .optional()
          .describe("id d'un style visuel (list_visual_styles) à appliquer. Son prompt est ajouté en suffixe au prompt fourni."),
      },
    },
    async ({ prompt, aspect_ratio, tags, style_id }) => {
      const st = style_id ? await getStyle(style_id) : undefined;
      const finalPrompt = composePrompt(prompt, st?.prompt);
      const { bytes, mimeType } = await generateImage(finalPrompt, aspect_ratio ?? "1:1");
      const rec = await store({
        bytes,
        mimeType,
        kind: "image",
        prompt: finalPrompt,
        parent_id: null,
        source: "gemini_generate",
        tags: tags ?? [],
        style_id: style_id ?? null,
      });
      return imageResult(bytes, mimeType, {
        id: rec.id,
        url: rec.url,
        prompt: rec.prompt,
        width: rec.width,
        height: rec.height,
      });
    },
  );

  server.registerTool(
    "edit_image",
    {
      description:
        "Édite une image existante (par son id) avec un prompt, via Gemini. Crée une nouvelle image liée à la source.",
      inputSchema: {
        image_id: z
          .string()
          .min(1)
          .describe("id d'une image existante (issu de generate_image, render_html ou list_images) servant de source."),
        edit_prompt: z
          .string()
          .min(1)
          .describe("Modification à appliquer, en langage naturel. Ex: 'assombris le fond', 'ajoute un chapeau rouge'."),
        tags: z
          .array(z.string())
          .optional()
          .describe("Étiquettes libres pour retrouver la variante via list_images."),
      },
    },
    async ({ image_id, edit_prompt, tags }) => {
      const source = await getMediaRecord(image_id);
      if (!source) throw new Error(`Image introuvable: ${image_id}`);
      const src = await getImageBytes(source.r2_key);
      if (!src) throw new Error(`Fichier source absent du bucket: ${source.r2_key}`);

      const { bytes, mimeType } = await editImage(src.bytes, src.contentType, edit_prompt);
      const rec = await store({
        bytes,
        mimeType,
        kind: "image",
        prompt: edit_prompt,
        parent_id: source.id,
        source: "gemini_edit",
        tags: tags ?? [],
      });
      return imageResult(bytes, mimeType, {
        id: rec.id,
        url: rec.url,
        prompt: rec.prompt,
        parent_id: rec.parent_id,
        width: rec.width,
        height: rec.height,
      });
    },
  );

  server.registerTool(
    "render_html",
    {
      description:
        "Rend un HTML autonome en image aux dimensions données (Chromium partagé). L'agent fournit tout le HTML/CSS. " +
        "Tailles courantes : Open Graph 1200×630, carré 1080×1080, story 1080×1920, cover article 1200×675. " +
        "format défaut png ; webp/jpeg (avec quality) pour alléger les visuels typographiques. " +
        "wait_for : sélecteur CSS à attendre ou délai en ms si le contenu se charge en JS.",
      inputSchema: {
        html: z
          .string()
          .min(1)
          .describe("HTML complet et autonome (CSS inline ou via <link>/CDN, polices incluses). Aucune substitution côté serveur."),
        width: z.number().int().positive().describe("Largeur du viewport en pixels (= largeur de l'image)."),
        height: z.number().int().positive().describe("Hauteur du viewport en pixels (= hauteur de l'image)."),
        format: z
          .enum(["png", "webp", "jpeg"])
          .optional()
          .describe("Format de sortie. Défaut png. webp/jpeg (avec quality) allègent 3-5× les visuels typographiques."),
        quality: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Qualité 1-100 pour webp/jpeg. Ignoré en png."),
        wait_for: z
          .union([z.string(), z.number().int().positive()])
          .optional()
          .describe("Sélecteur CSS à attendre, ou délai en ms (max 15000), si le contenu se charge en JS. Sinon inutile."),
        tags: z
          .array(z.string())
          .optional()
          .describe("Étiquettes libres pour retrouver l'image via list_images."),
      },
    },
    async ({ html, width, height, format, quality, wait_for, tags }) => {
      const { bytes, mimeType } = await renderHtml({
        html,
        width,
        height,
        format,
        quality,
        waitFor: wait_for,
      });
      const rec = await store({
        bytes,
        mimeType,
        kind: "render",
        prompt: null,
        parent_id: null,
        source: "html_render",
        tags: tags ?? [],
        width,
        height,
      });
      return imageResult(bytes, mimeType, {
        id: rec.id,
        url: rec.url,
        width: rec.width,
        height: rec.height,
      });
    },
  );

  server.registerTool(
    "list_images",
    {
      description:
        "Liste les images (tri par date décroissante). Filtres optionnels : recherche sur prompt, tags (intersection), source.",
      inputSchema: {
        query: z.string().optional().describe("Recherche texte sur le prompt (correspondance partielle)."),
        tags: z
          .array(z.string())
          .optional()
          .describe("Filtre par tags : toutes les tags fournies doivent être présentes (intersection)."),
        source: z
          .enum(["gemini_generate", "gemini_edit", "html_render", "upload"])
          .optional()
          .describe("Filtre par origine : gemini_generate, gemini_edit, html_render ou upload."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Nombre max de résultats. Défaut 20, max 100."),
      },
    },
    async ({ query, tags, source, limit }) => {
      const records = await listMediaRecords({ query, tags, source, limit });
      return jsonResult(records);
    },
  );

  server.registerTool(
    "get_image",
    {
      description: "Récupère les métadonnées d'une image par son id (null si inconnue).",
      inputSchema: { image_id: z.string().min(1).describe("id de l'image à récupérer.") },
    },
    async ({ image_id }) => {
      const rec = await getMediaRecord(image_id);
      return jsonResult(rec);
    },
  );

  server.registerTool(
    "delete_image",
    {
      description: "Supprime une image (objet R2 + ligne Postgres). Renvoie deleted:false si l'id est inconnu.",
      inputSchema: { image_id: z.string().min(1).describe("id de l'image à supprimer définitivement.") },
    },
    async ({ image_id }) => {
      const rec = await getMediaRecord(image_id);
      if (!rec) return jsonResult({ deleted: false });
      // Ligne d'abord : si l'objet R2 échoue ensuite, on a au pire un orphelin inoffensif.
      const deleted = await deleteMediaRow(image_id);
      if (deleted) {
        await deleteObject(rec.r2_key);
      }
      return jsonResult({ deleted });
    },
  );

  registerStyleTools(server);
  registerStyleGuideTools(server);
  registerBrandTools(server);
  registerTemplateTools(server);
}
