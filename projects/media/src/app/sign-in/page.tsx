import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { isPreview } from "@/lib/auth/preview";

export const dynamic = "force-dynamic";

// /sign-in : en prod, redirige vers le SSO central. En preview, court-circuite
// (le middleware laisse déjà passer, et requireUserId court-circuite avec
// PREVIEW_USER_ID) → renvoie directement vers l'admin.
export default function SignInPage() {
  if (isPreview) redirect("/gallery");
  redirect(`${env.AUTH_URL}/sign-in?redirect=${encodeURIComponent(env.APP_URL)}`);
}
