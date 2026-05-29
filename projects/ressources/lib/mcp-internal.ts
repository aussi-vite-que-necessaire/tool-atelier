import { z } from "zod"
import { tools, toolsByName } from "@/lib/resources/registry"
import { getOperatorById } from "@/lib/auth/operator"

export type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean }

// Catalogue : nom + description + JSON Schema (Zod → JSON Schema via Zod v4).
export function listToolsResponse() {
  return {
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: z.toJSONSchema(z.object(t.inputSchema)),
    })),
  }
}

// Exécute un tool par nom. ressources est multi-tenant (ADR-0002) : on résout
// l'opérateur depuis le userId transmis par la passerelle, et on le dépose dans
// extra.authInfo.extra (operatorId/operatorHandle) — ce que les tools lisent via
// operatorFrom. Un compte non-opérateur reçoit un résultat isError (pas un crash).
export async function callToolByName(
  name: string,
  userId: string,
  args: unknown,
): Promise<ToolResult> {
  const tool = toolsByName.get(name)
  if (!tool) throw new Error(`Tool inconnu: ${name}`)
  const op = await getOperatorById(userId)
  if (!op) {
    return {
      content: [{ type: "text", text: "Accès réservé aux opérateurs (aucun opérateur pour ce compte)." }],
      isError: true,
    }
  }
  // La validation MCP du SDK est court-circuitée par la capture : on la refait ici.
  const parsed = z.object(tool.inputSchema).safeParse(args ?? {})
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const path = issue?.path?.join(".")
    const msg = issue?.message ?? "Arguments invalides"
    throw new Error(path ? `${path}: ${msg}` : msg)
  }
  const extra = { authInfo: { extra: { userId, operatorId: op.id, operatorHandle: op.handle } } }
  return (await tool.handler(parsed.data as Record<string, unknown>, extra)) as ToolResult
}
