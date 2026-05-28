import { env } from "@/lib/env";

// media est une ressource protégée par OAuth du provider central.
export function GET(): Response {
  return Response.json({
    resource: env.APP_URL,
    authorization_servers: [env.AUTH_URL],
    bearer_methods_supported: ["header"],
  });
}
