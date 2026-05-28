import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { verifyMcpToken } from '@/lib/mcp/auth';
import { registerAllTools } from '@/lib/mcp/server';

const base = createMcpHandler(
  (server) => registerAllTools(server),
  { serverInfo: { name: 'content-os', version: '1' } },
  { basePath: '/api' },
);

const handler = withMcpAuth(base, (req) => verifyMcpToken(req), {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
});

export { handler as GET, handler as POST, handler as DELETE };
