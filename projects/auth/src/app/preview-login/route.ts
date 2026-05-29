import { auth } from "@/lib/auth";
import { isPreview, PREVIEW_OTP } from "@/lib/auth-preview";
import { PREVIEW_USERS } from "@/lib/preview-users";

export const dynamic = "force-dynamic";

// Whitelist : domaines de la suite contentos uniquement.
function safeRedirect(raw: string | null): string {
  if (!raw) return "/";
  try {
    const u = new URL(raw);
    if (u.hostname === "contentos.ch") return raw;
    if (u.hostname.endsWith(".contentos.ch")) return raw;
    if (u.hostname.endsWith(".preview.contentos.ch")) return raw;
    return "/";
  } catch {
    return "/";
  }
}

// Auto-connexion de preview : ouvre une VRAIE session BetterAuth pour user1/2/3
// (code OTP déterministe 000000, forcé hors prod), puis redirige. Jamais en prod.
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const target = safeRedirect(url.searchParams.get("redirect"));
  if (!isPreview) {
    return new Response(null, { status: 302, headers: { Location: "/sign-in" } });
  }
  const key = url.searchParams.get("user") ?? "1";
  const u = PREVIEW_USERS[key as "1" | "2" | "3"];
  if (!u) return new Response(null, { status: 302, headers: { Location: "/sign-in" } });

  // Pose l'OTP (000000 en preview) puis le vérifie pour matérialiser la session.
  await auth.api.sendVerificationOTP({ body: { email: u.email, type: "sign-in" } });
  const signed = await auth.api.signInEmailOTP({
    body: { email: u.email, otp: PREVIEW_OTP },
    asResponse: true,
  });

  const headers = new Headers({ Location: target });
  for (const cookie of signed.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}
