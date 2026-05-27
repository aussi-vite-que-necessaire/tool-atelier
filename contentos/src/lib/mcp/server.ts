import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { userIdFrom } from './auth';
import { jsonResult } from './result';
import { registerConfigTools } from './tools/config';
import { registerIdeaTools } from './tools/ideas';
import { registerMediaTools } from './tools/media';
import { registerPostTools } from './tools/posts';
import { registerPublishingTools } from './tools/publishing';
import { registerStyleGuideTools } from './tools/style-guides';
import { registerVisualTools } from './tools/visuals';
import { registerVoiceTools } from './tools/voices';

export function registerAllTools(server: McpServer): void {
  server.registerTool(
    'ping',
    {
      title: 'Ping',
      description: 'Vérifie la connexion et renvoie l’identité du compte.',
      inputSchema: {},
    },
    async (_input, extra) => jsonResult({ ok: true, userId: userIdFrom(extra) }),
  );
  registerIdeaTools(server);
  registerPostTools(server);
  registerConfigTools(server);
  registerMediaTools(server);
  registerPublishingTools(server);
  registerStyleGuideTools(server);
  registerVisualTools(server);
  registerVoiceTools(server);
}
