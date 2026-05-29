'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
} from '@/components/ui/sidebar';

export type NavLink = { href: string; label: string };
export type NavSection = { label?: string; links: NavLink[] };

/**
 * AppShell — cadre applicatif partagé de la suite contentos.
 *
 * Sidebar (lien « Contentos » vers la suite + nom du projet, sections de nav,
 * footer libre) à gauche, contenu cadré à droite. Présentationnel : la garde
 * d'auth reste dans le layout serveur, qui passe `homeUrl` (cf. centralUrl) et
 * une nav déclarative en texte.
 */
export function AppShell({
  project,
  homeUrl,
  sections,
  footer,
  children,
}: {
  project: string;
  homeUrl: string;
  sections: NavSection[];
  footer?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen">
      <Sidebar>
        <SidebarHeader>
          <a
            href={homeUrl}
            className="block text-xs font-medium tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            Contentos
          </a>
          <span className="mt-1 block text-lg font-semibold text-sidebar-foreground">
            {project}
          </span>
        </SidebarHeader>
        {sections.map((section, i) => (
          <SidebarSection key={i} label={section.label}>
            {section.links.map((link) => (
              <SidebarItem
                key={link.href}
                active={pathname?.startsWith(link.href) ?? false}
                render={<Link href={link.href} />}
              >
                {link.label}
              </SidebarItem>
            ))}
          </SidebarSection>
        ))}
        {footer ? <SidebarFooter>{footer}</SidebarFooter> : null}
      </Sidebar>
      <main className="min-w-0 flex-1 overflow-x-clip">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">{children}</div>
      </main>
    </div>
  );
}
