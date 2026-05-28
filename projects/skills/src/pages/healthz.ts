import type { APIRoute } from "astro";

export const prerender = false;

// Healthcheck : ne touche pas la base, doit répondre même avant migration.
export const GET: APIRoute = () =>
  new Response("ok", { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
