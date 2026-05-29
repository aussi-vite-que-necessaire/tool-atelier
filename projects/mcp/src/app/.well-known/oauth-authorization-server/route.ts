import { env } from "@/lib/env";

// Délègue la découverte OAuth aux clients vers le provider central.
export function GET(): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: `${env.AUTH_URL}/.well-known/oauth-authorization-server` },
  });
}
