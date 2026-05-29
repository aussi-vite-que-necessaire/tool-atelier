// Sonde de santé : GET /healthz → 200 "ok". Ne touche pas la base.
// force-dynamic : la route est servie par le serveur node du build standalone
// (une route force-static est prérendue et n'est pas servie en sortie standalone).
export const dynamic = "force-dynamic"

export function GET() {
  return new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain" },
  })
}
