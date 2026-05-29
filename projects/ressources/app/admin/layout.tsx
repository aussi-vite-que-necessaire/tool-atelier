import { requireOperator } from "@/lib/auth/operator"
import { signOutAction } from "@/lib/actions/account"
import { env } from "@/lib/env"
import { AppShell, type NavSection } from "@/components/ui/app-shell"
import { centralUrl } from "@/lib/central-url"

export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const op = await requireOperator()
  const sections: NavSection[] = [
    { links: [
      { href: "/admin", label: "Bord" },
      { href: "/admin/audience", label: "Audience" },
      { href: "/admin/settings", label: "Réglages" },
    ] },
    { label: "Public", links: [
      { href: `/o/${op.handle}`, label: "Espace ↗" },
    ] },
  ]
  return (
    <AppShell
      project="Ressources"
      homeUrl={centralUrl(env.APP_ENV)}
      sections={sections}
      footer={
        <form action={signOutAction}>
          <button type="submit" className="hover:text-foreground">
            Déconnexion
          </button>
        </form>
      }
    >
      {children}
    </AppShell>
  )
}
