import { type NextRequest, NextResponse } from "next/server";

// Tout est public au sens cookie : l'API MCP s'auth en Bearer (withMcpAuth),
// la découverte OAuth est publique, healthz aussi. Pas de pages protégées.
export function middleware(_request: NextRequest): NextResponse {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/mcp|\\.well-known|healthz|_next|favicon).*)"],
};
