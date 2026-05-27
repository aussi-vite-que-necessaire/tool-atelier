import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResult } from "@/lib/mcp/result";
import { aggregatePdf } from "@/lib/pdf/aggregate";

export function registerPdfTools(server: McpServer): void {
  server.registerTool(
    "create_pdf",
    {
      description:
        "Assemble des images existantes en un seul PDF, une image par page " +
        "(ex. document LinkedIn / carrousel swipeable). " +
        "Retourne l'id et l'URL publique du PDF généré.",
      inputSchema: {
        image_ids: z
          .array(z.string())
          .min(1)
          .describe(
            "ids d'images, dans l'ordre des pages. Chaque id doit correspondre à une image ou un rendu existant.",
          ),
      },
    },
    async ({ image_ids }) => {
      const rec = await aggregatePdf(image_ids);
      return jsonResult({ id: rec.id, url: rec.url });
    },
  );
}
