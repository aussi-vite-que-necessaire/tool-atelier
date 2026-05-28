import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResult } from "@/lib/mcp/result";
import { getBrand, upsertBrand } from "@/lib/brand/repository";

export function registerBrandTools(server: McpServer): void {
  server.registerTool(
    "get_brand",
    {
      description:
        "Récupère l'identité globale de la marque (nom, ligne de signature, URL du logo) injectée dans les templates visuels " +
        "sous les variables {{brand.name}}, {{brand.signature}}, {{brand.logo}}.",
      inputSchema: {},
    },
    async () => {
      return jsonResult(await getBrand() ?? { name: "", signature: "", logoUrl: null });
    },
  );

  server.registerTool(
    "update_brand",
    {
      description:
        "Met à jour l'identité globale de la marque. Seuls les champs fournis sont modifiés ; les autres conservent leur valeur courante. " +
        "Les valeurs sont injectées dans les templates visuels sous {{brand.name}}, {{brand.signature}}, {{brand.logo}}.",
      inputSchema: {
        name: z.string().optional().describe("Nom de la marque, ex. « AVQN »."),
        signature: z
          .string()
          .optional()
          .describe("Ligne de signature, ex. « — Manu ». Laisser vide pour supprimer."),
        logo_url: z
          .string()
          .optional()
          .describe("URL publique du logo (png/svg). Laisser vide pour supprimer."),
      },
    },
    async ({ name, signature, logo_url }) => {
      // Lire l'état courant pour préserver les champs non fournis.
      const current = await getBrand();
      const merged = {
        name: name !== undefined ? name : (current?.name ?? ""),
        signature: signature !== undefined ? signature : (current?.signature ?? ""),
        logoUrl: logo_url !== undefined ? logo_url : (current?.logoUrl ?? null),
      };
      const row = await upsertBrand(merged);
      return jsonResult(row);
    },
  );
}
