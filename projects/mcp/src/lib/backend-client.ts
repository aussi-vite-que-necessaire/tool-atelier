import type { Backend } from "./backends";

export type RemoteTool = { name: string; description: string; inputSchema: Record<string, unknown> };
export type ToolResult = { content: Array<{ type: "text"; text: string }>; isError?: boolean };

// Catalogue d'un backend via son contrat interne.
export async function listTools(backend: Backend): Promise<RemoteTool[]> {
  const res = await fetch(`${backend.baseUrl}/internal/tools`, {
    headers: { Authorization: `Bearer ${backend.serviceKey}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Backend ${backend.prefix} listTools ${res.status}`);
  const body = (await res.json()) as { tools: RemoteTool[] };
  return body.tools;
}

// Exécute un tool d'un backend. Une erreur HTTP du backend (4xx/5xx) est
// convertie en résultat MCP isError (dégradation gracieuse, pas un crash).
export async function callTool(
  backend: Backend,
  name: string,
  userId: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const res = await fetch(`${backend.baseUrl}/internal/tools/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${backend.serviceKey}`, "content-type": "application/json" },
    body: JSON.stringify({ userId, args }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { result?: ToolResult; error?: string };
  if (!res.ok || !body.result) {
    const message = body.error ?? `Backend ${backend.prefix} erreur ${res.status}`;
    return { content: [{ type: "text", text: message }], isError: true };
  }
  return body.result;
}
