import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResult } from "@/lib/mcp/result";
import { createStyle, listStyles, updateStyle, deleteStyle } from "@/lib/styles/repository";

export function registerStyleTools(server: McpServer): void {
  server.registerTool(
    "list_visual_styles",
    {
      description:
        "Liste tous les styles visuels disponibles. Un style est un suffixe de prompt réutilisable (ex. « rendu 3D doux », « flat 2D »). " +
        "Utilise l'id retourné pour appliquer un style via style_id dans generate_image.",
      inputSchema: {},
    },
    async () => {
      return jsonResult(await listStyles());
    },
  );

  server.registerTool(
    "create_visual_style",
    {
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
    },
    async ({ name, prompt }) => {
      const row = await createStyle({ name, prompt });
      return jsonResult(row);
    },
  );

  server.registerTool(
    "update_visual_style",
    {
      description: "Met à jour le nom et/ou le prompt d'un style visuel existant.",
      inputSchema: {
        style_id: z
          .string()
          .min(1)
          .describe("id du style à modifier (issu de list_visual_styles ou create_visual_style)."),
        name: z.string().optional().describe("Nouveau nom du style."),
        prompt: z.string().optional().describe("Nouveau prompt du style."),
      },
    },
    async ({ style_id, name, prompt }) => {
      const row = await updateStyle(style_id, { ...(name !== undefined ? { name } : {}), ...(prompt !== undefined ? { prompt } : {}) });
      if (!row) return jsonResult({ error: `Style introuvable: ${style_id}` });
      return jsonResult(row);
    },
  );

  server.registerTool(
    "delete_visual_style",
    {
      description: "Supprime définitivement un style visuel. Les images générées avec ce style ne sont pas affectées.",
      inputSchema: {
        style_id: z
          .string()
          .min(1)
          .describe("id du style à supprimer (issu de list_visual_styles)."),
      },
    },
    async ({ style_id }) => {
      await deleteStyle(style_id);
      return jsonResult({ deleted: true });
    },
  );
}
