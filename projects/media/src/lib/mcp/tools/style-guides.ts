import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResult } from "@/lib/mcp/result";
import { createGuide, getGuide, listGuides, updateGuide, deleteGuide } from "@/lib/style-guides/repository";

export function registerStyleGuideTools(server: McpServer): void {
  server.registerTool(
    "list_style_guides",
    {
      description:
        "Liste toutes les chartes graphiques disponibles. Une charte est une référence markdown (palette, typographie, conventions visuelles) " +
        "qu'un template peut lier pour garder une cohérence de marque.",
      inputSchema: {},
    },
    async () => {
      return jsonResult(await listGuides());
    },
  );

  server.registerTool(
    "get_style_guide",
    {
      description:
        "Récupère le contenu complet d'une charte graphique par son id. " +
        "Retourne la charte ou un objet { error } si l'id est inconnu.",
      inputSchema: {
        guide_id: z
          .string()
          .min(1)
          .describe("id de la charte à récupérer (issu de list_style_guides ou create_style_guide)."),
      },
    },
    async ({ guide_id }) => {
      const guide = await getGuide(guide_id);
      if (!guide) return jsonResult({ error: `Charte introuvable: ${guide_id}` });
      return jsonResult(guide);
    },
  );

  server.registerTool(
    "create_style_guide",
    {
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
    },
    async ({ name, content }) => {
      const row = await createGuide({ name, content });
      return jsonResult(row);
    },
  );

  server.registerTool(
    "update_style_guide",
    {
      description: "Met à jour le nom et/ou le contenu markdown d'une charte graphique existante.",
      inputSchema: {
        guide_id: z
          .string()
          .min(1)
          .describe("id de la charte à modifier (issu de list_style_guides ou create_style_guide)."),
        name: z.string().optional().describe("Nouveau nom de la charte."),
        content: z.string().optional().describe("Nouveau contenu markdown de la charte."),
      },
    },
    async ({ guide_id, name, content }) => {
      const row = await updateGuide(guide_id, {
        ...(name !== undefined ? { name } : {}),
        ...(content !== undefined ? { content } : {}),
      });
      if (!row) return jsonResult({ error: `Charte introuvable: ${guide_id}` });
      return jsonResult(row);
    },
  );

  server.registerTool(
    "delete_style_guide",
    {
      description:
        "Supprime définitivement une charte graphique. Les templates liés voient leur référence mise à null (set null).",
      inputSchema: {
        guide_id: z
          .string()
          .min(1)
          .describe("id de la charte à supprimer (issu de list_style_guides)."),
      },
    },
    async ({ guide_id }) => {
      await deleteGuide(guide_id);
      return jsonResult({ deleted: true });
    },
  );
}
