import { auth } from "@/lib/auth";
import { isPreview } from "@/lib/auth-preview";
import { PREVIEW_MARKER_COOKIE, PREVIEW_COOKIE_DOMAIN } from "@/lib/preview-users";

export const dynamic = "force-dynamic";

function safeRedirect(raw: string | null): string {
  if (!raw) return "/";
  try {
    const u = new URL(raw);
    if (u.hostname === "contentos.ch" || u.hostname.endsWith(".contentos.ch")) return raw;
    return "/";
  } catch {
    return "/";
  }
}

// Déconnexion de preview : efface la session ET pose le marqueur suite-wide
// `cos_preview_login=manual` (tant qu'il est là, les clients montrent le chooser
// au lieu d'auto-connecter). Puis renvoie vers le chooser. Jamais en prod.
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const back = safeRedirect(url.searchParams.get("redirect"));
  if (!isPreview) {
    return new Response(null, { status: 302, headers: { Location: "/sign-in" } });
  }
  const cleared = await auth.api.signOut({ headers: req.headers, asResponse: true });
  const location = `/sign-in?redirect=${encodeURIComponent(back)}`;
  const headers = new Headers({ Location: location });
  for (const cookie of cleared.headers.getSetCookie()) headers.append("set-cookie", cookie);
  headers.append(
    "set-cookie",
    `${PREVIEW_MARKER_COOKIE}=manual; Domain=${PREVIEW_COOKIE_DOMAIN}; Path=/; Max-Age=31536000; Secure; SameSite=Lax`,
  );
  return new Response(null, { status: 302, headers });
}
