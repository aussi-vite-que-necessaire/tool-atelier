import { z } from "zod";
import { jsonResult } from "@/lib/mcp/result";
import { getBrand, upsertBrand } from "@/lib/brand/repository";
import type { ToolDef } from "../types";

export const brandTools: ToolDef[] = [
  {
    name: "get_brand",
    description:
      "Récupère l'identité globale de la marque (nom, ligne de signature, URL du logo) injectée dans les templates visuels " +
      "sous les variables {{brand.name}}, {{brand.signature}}, {{brand.logo}}.",
    inputSchema: {},
    handler: async (userId, _args) => {
      return jsonResult(await getBrand(userId) ?? { name: "", signature: "", logoUrl: null });
    },
  },
  {
    name: "update_brand",
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
    handler: async (userId, args) => {
      const { name, signature, logo_url } = args as { name?: string; signature?: string; logo_url?: string };
      // Lire l'état courant pour préserver les champs non fournis.
      const current = await getBrand(userId);
      const merged = {
        name: name !== undefined ? name : (current?.name ?? ""),
        signature: signature !== undefined ? signature : (current?.signature ?? ""),
        logoUrl: logo_url !== undefined ? logo_url : (current?.logoUrl ?? null),
      };
      const row = await upsertBrand(userId, merged);
      return jsonResult(row);
    },
  },
];
