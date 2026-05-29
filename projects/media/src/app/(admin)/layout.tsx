import { requireUserId, signOutUrl } from "@/lib/session";
import { env } from "@/lib/env";
import { AppShell, type NavSection } from "@/components/ui/app-shell";
import { centralUrl } from "@/lib/central-url";
import { Toaster } from "@/components/ui/sonner";
import { SignOutButton } from "./sign-out-button";

export const dynamic = "force-dynamic";

const sections: NavSection[] = [
  { links: [{ href: "/gallery", label: "Galerie" }] },
  {
    label: "Bibliothèque",
    links: [
      { href: "/templates", label: "Templates" },
      { href: "/styles", label: "Styles" },
      { href: "/style-guides", label: "Chartes" },
      { href: "/brand", label: "Marque" },
    ],
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUserId();
  return (
    <AppShell
      project="Media"
      homeUrl={centralUrl(env.APP_ENV)}
      sections={sections}
      footer={<SignOutButton href={signOutUrl()} />}
    >
      {children}
      <Toaster />
    </AppShell>
  );
}
