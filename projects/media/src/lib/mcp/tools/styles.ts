import { z } from "zod";
import { jsonResult, errorResult } from "@/lib/mcp/result";
import { createStyle, listStyles, updateStyle, deleteStyle } from "@/lib/styles/repository";
import type { ToolDef } from "../types";

export const styleTools: ToolDef[] = [
  {
    name: "list_visual_styles",
    description:
      "Liste tous les styles visuels disponibles. Un style est un suffixe de prompt réutilisable (ex. « rendu 3D doux », « flat 2D »). " +
      "Utilise l'id retourné pour appliquer un style via style_id dans generate_image.",
    inputSchema: {},
    handler: async (userId, _args) => {
      return jsonResult(await listStyles(userId));
    },
  },
  {
    name: "create_visual_style",
    description:
      "Crée un nouveau style visuel (nom + prompt). Le prompt est ajouté en suffixe lors de la génération d'image. " +
      "Exemples : nom « 3D », prompt « rendu 3D, éclairage volumétrique, ombres douces ».",
    inputSchema: {
      name: z.string().min(1).describe("Nom court du style, ex. « 3D », « 2D flat », « aquarelle »."),
      prompt: z
        .string()
        .min(1)
        .describe(
          "Texte ajouté en suffixe au prompt de génération. Décrit l'esthétique : technique, matière, éclairage, ambiance.",
        ),
    },
    handler: async (userId, args) => {
      const { name, prompt } = args as { name: string; prompt: string };
      const row = await createStyle(userId, { name, prompt });
      return jsonResult(row);
    },
  },
  {
    name: "update_visual_style",
    description: "Met à jour le nom et/ou le prompt d'un style visuel existant.",
    inputSchema: {
      style_id: z
        .string()
        .min(1)
        .describe("id du style à modifier (issu de list_visual_styles ou create_visual_style)."),
      name: z.string().optional().describe("Nouveau nom du style."),
      prompt: z.string().optional().describe("Nouveau prompt du style."),
    },
    handler: async (userId, args) => {
      const { style_id, name, prompt } = args as { style_id: string; name?: string; prompt?: string };
      const row = await updateStyle(userId, style_id, {
        ...(name !== undefined ? { name } : {}),
        ...(prompt !== undefined ? { prompt } : {}),
      });
      if (!row) return errorResult(`Style introuvable: ${style_id}`);
      return jsonResult(row);
    },
  },
  {
    name: "delete_visual_style",
    description: "Supprime définitivement un style visuel. Les images générées avec ce style ne sont pas affectées.",
    inputSchema: {
      style_id: z
        .string()
        .min(1)
        .describe("id du style à supprimer (issu de list_visual_styles)."),
    },
    handler: async (userId, args) => {
      const { style_id } = args as { style_id: string };
      await deleteStyle(userId, style_id);
      return jsonResult({ deleted: true });
    },
  },
];
