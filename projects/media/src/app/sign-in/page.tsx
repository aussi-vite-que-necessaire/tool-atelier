import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { OtpForm } from "./otp-form";

export const dynamic = "force-dynamic";

// loginPage du plugin MCP : l'OAuth y renvoie le navigateur avec la requête d'autorisation en
// attente (param `redirect`/`redirectTo`) ; après connexion, OtpForm y revient pour la reprendre.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; redirectTo?: string }>;
}) {
  const sp = await searchParams;
  const target = sp.redirect || sp.redirectTo || "/gallery";
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect(target);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold">Connexion à media</h1>
      <p className="text-sm text-gray-600">Reçois un code par email pour te connecter.</p>
      <OtpForm redirectTo={target} />
    </main>
  );
}
