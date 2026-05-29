import { requireUserId } from "@/lib/session";
import { env } from "@/lib/env";
import { Toaster } from "@/components/ui/sonner";
import { AdminNav } from "./admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Garde de session : redirige vers le SSO si absente.
  await requireUserId();

  return (
    <div className="flex min-h-screen">
      <AdminNav authUrl={env.AUTH_URL} />
      <main className="flex-1 p-6 sm:p-8">{children}</main>
      <Toaster />
    </div>
  );
}
