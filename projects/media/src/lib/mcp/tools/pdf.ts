import { z } from "zod";
import { jsonResult } from "@/lib/mcp/result";
import { aggregatePdf } from "@/lib/pdf/aggregate";
import type { ToolDef } from "../types";

export const pdfTools: ToolDef[] = [
  {
    name: "create_pdf",
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
    handler: async (userId, args) => {
      const { image_ids } = args as { image_ids: string[] };
      const rec = await aggregatePdf(userId, image_ids);
      return jsonResult({ id: rec.id, url: rec.url });
    },
  },
];
