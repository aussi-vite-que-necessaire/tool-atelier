import type { ZodRawShape } from 'zod';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { registerAllTools } from './server';

// Résultat MCP (content blocks) renvoyé par un tool.
export type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };
type Extra = { authInfo?: AuthInfo };
type Handler = (args: Record<string, unknown>, extra: Extra) => Promise<ToolResult> | ToolResult;
export type CapturedTool = { name: string; description: string; inputSchema: ZodRawShape; handler: Handler };

// Capture les tools déclarés par registerAllTools sans dépendre du transport MCP :
// on passe un faux serveur qui enregistre les définitions au lieu de les servir.
function capture(): CapturedTool[] {
  const tools: CapturedTool[] = [];
  const fakeServer = {
    registerTool(
      name: string,
      config: { description?: string; inputSchema?: ZodRawShape },
      handler: Handler,
    ) {
      tools.push({
        name,
        description: config.description ?? '',
        inputSchema: config.inputSchema ?? {},
        handler,
      });
    },
  };
  registerAllTools(fakeServer as never);
  return tools;
}

export const tools: CapturedTool[] = capture();
export const toolsByName = new Map<string, CapturedTool>(tools.map((t) => [t.name, t]));
