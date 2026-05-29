import { z } from "zod";
import { tools, toolsByName } from "./registry";
import { errorResult } from "./result";
import type { ToolResult } from "./types";

// Catalogue : nom + description + JSON Schema (Zod → JSON Schema via Zod v4).
export function listToolsResponse() {
  return {
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: z.toJSONSchema(z.object(t.inputSchema)),
    })),
  };
}

// Exécute un tool par nom : valide les args contre son schéma Zod, puis appelle
// le handler avec le userId fourni (de confiance, transmis par la passerelle).
// Une erreur métier (throw) est convertie en résultat MCP isError par l'appelant
// HTTP ; ici on laisse remonter pour les cas tool inconnu / args invalides.
export async function callToolByName(
  name: string,
  userId: string,
  args: unknown,
): Promise<ToolResult> {
  const tool = toolsByName.get(name);
  if (!tool) throw new Error(`Tool inconnu: ${name}`);
  const parsed = z.object(tool.inputSchema).safeParse(args ?? {});
  if (!parsed.success) {
    // Préfixe le message par le champ fautif (ex. "prompt: …") : plus utile pour
    // l'agent appelant qu'un message Zod brut sans contexte.
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join(".");
    throw new Error(path ? `${path}: ${issue.message}` : (issue?.message ?? "Arguments invalides"));
  }
  try {
    return await tool.handler(userId, parsed.data as Record<string, unknown>);
  } catch (e) {
    // Erreur métier → résultat isError (pas une 500 transport).
    return errorResult(e instanceof Error ? e.message : String(e));
  }
}
