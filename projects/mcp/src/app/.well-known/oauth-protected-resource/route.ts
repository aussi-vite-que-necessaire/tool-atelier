import { env } from "@/lib/env";

// La passerelle est la seule ressource protégée OAuth de la suite.
export function GET(): Response {
  return Response.json({
    resource: env.APP_URL,
    authorization_servers: [env.AUTH_URL],
    bearer_methods_supported: ["header"],
  });
}
