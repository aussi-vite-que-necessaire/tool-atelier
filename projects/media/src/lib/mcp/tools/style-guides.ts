import { z } from "zod";
import { jsonResult, errorResult } from "@/lib/mcp/result";
import { createGuide, getGuide, listGuides, updateGuide, deleteGuide } from "@/lib/style-guides/repository";
import type { ToolDef } from "../types";

export const styleGuideTools: ToolDef[] = [
  {
    name: "list_style_guides",
    description:
      "Liste toutes les chartes graphiques disponibles. Une charte est une référence markdown (palette, typographie, conventions visuelles) " +
      "qu'un template peut lier pour garder une cohérence de marque.",
    inputSchema: {},
    handler: async (userId, _args) => {
      return jsonResult(await listGuides(userId));
    },
  },
  {
    name: "get_style_guide",
    description:
      "Récupère le contenu complet d'une charte graphique par son id. " +
      "Retourne la charte ou un objet { error } si l'id est inconnu.",
    inputSchema: {
      guide_id: z
        .string()
        .min(1)
        .describe("id de la charte à récupérer (issu de list_style_guides ou create_style_guide)."),
    },
    handler: async (userId, args) => {
      const { guide_id } = args as { guide_id: string };
      const guide = await getGuide(userId, guide_id);
      if (!guide) return errorResult(`Charte introuvable: ${guide_id}`);
      return jsonResult(guide);
    },
  },
  {
    name: "create_style_guide",
    description:
      "Crée une nouvelle charte graphique (nom + contenu markdown). " +
      "Le contenu documente la palette de couleurs, la typographie et les conventions visuelles de la marque.",
    inputSchema: {
      name: z.string().min(1).describe("Nom court de la charte, ex. « Acme Corp », « Produit Beta »."),
      content: z
        .string()
        .describe(
          "Contenu markdown de la charte : palette (codes hex), typographies, règles de composition, exemples.",
        ),
    },
    handler: async (userId, args) => {
      const { name, content } = args as { name: string; content: string };
      const row = await createGuide(userId, { name, content });
      return jsonResult(row);
    },
  },
  {
    name: "update_style_guide",
    description: "Met à jour le nom et/ou le contenu markdown d'une charte graphique existante.",
    inputSchema: {
      guide_id: z
        .string()
        .min(1)
        .describe("id de la charte à modifier (issu de list_style_guides ou create_style_guide)."),
      name: z.string().optional().describe("Nouveau nom de la charte."),
      content: z.string().optional().describe("Nouveau contenu markdown de la charte."),
    },
    handler: async (userId, args) => {
      const { guide_id, name, content } = args as { guide_id: string; name?: string; content?: string };
      const row = await updateGuide(userId, guide_id, {
        ...(name !== undefined ? { name } : {}),
        ...(content !== undefined ? { content } : {}),
      });
      if (!row) return errorResult(`Charte introuvable: ${guide_id}`);
      return jsonResult(row);
    },
  },
  {
    name: "delete_style_guide",
    description:
      "Supprime définitivement une charte graphique. Les templates liés voient leur référence mise à null (set null).",
    inputSchema: {
      guide_id: z
        .string()
        .min(1)
        .describe("id de la charte à supprimer (issu de list_style_guides)."),
    },
    handler: async (userId, args) => {
      const { guide_id } = args as { guide_id: string };
      await deleteGuide(userId, guide_id);
      return jsonResult({ deleted: true });
    },
  },
];
