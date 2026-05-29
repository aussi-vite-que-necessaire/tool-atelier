import type { ZodRawShape } from "zod";

// Bloc de contenu MCP renvoyé par un tool. URL-only : jamais de binaire/base64.
export type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

// Définition d'un tool, indépendante du transport (MCP public retiré).
// inputSchema = raw shape Zod (comme l'ancien registerTool). userId est fourni
// par l'appelant de confiance (la passerelle), plus par un token OAuth local.
export type ToolDef = {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  handler: (userId: string, args: Record<string, unknown>) => Promise<ToolResult>;
};
