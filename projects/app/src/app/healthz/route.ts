// Sonde de liveness pour l'atelier : 200 "ok" sans toucher la base ni Redis.
// La plateforme lab attend GET /healthz pour considérer le service prêt.
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return new Response('ok', {
    status: 200,
    headers: { 'content-type': 'text/plain' },
  });
}
