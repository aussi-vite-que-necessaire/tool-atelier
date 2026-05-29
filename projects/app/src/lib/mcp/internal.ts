import { z } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { tools, toolsByName, type ToolResult } from './registry';

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

// Exécute un tool par nom : valide les args (la validation MCP du SDK est
// court-circuitée par la capture, on la refait ici), puis appelle le handler
// avec un extra de confiance portant le userId transmis par la passerelle.
export async function callToolByName(
  name: string,
  userId: string,
  args: unknown,
): Promise<ToolResult> {
  const tool = toolsByName.get(name);
  if (!tool) throw new Error(`Tool inconnu: ${name}`);
  const parsed = z.object(tool.inputSchema).safeParse(args ?? {});
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.join('.');
    const msg = issue?.message ?? 'Arguments invalides';
    throw new Error(path ? `${path}: ${msg}` : msg);
  }
  const authInfo: AuthInfo = { token: 'internal', clientId: 'mcp-gateway', scopes: [], extra: { userId } };
  return tool.handler(parsed.data as Record<string, unknown>, { authInfo });
}
