'use client';
/* @generated — synchronisé depuis packages/ui par bin/ui-sync. Ne pas éditer ici : modifier packages/ui puis relancer la synchro. */

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { MenuIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
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
 * Contenu de navigation partagé entre la sidebar desktop et le drawer mobile.
 * Interne au shell : un seul endroit décrit l'en-tête, les sections et le footer.
 * `onNavigate` permet au drawer de se fermer au clic sur un lien.
 */
function SidebarNav({
  project,
  homeUrl,
  sections,
  footer,
  pathname,
  onNavigate,
}: {
  project: string;
  homeUrl: string;
  sections: NavSection[];
  footer?: ReactNode;
  pathname: string | null;
  onNavigate?: () => void;
}) {
  return (
    <>
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
              render={<Link href={link.href} onClick={onNavigate} />}
            >
              {link.label}
            </SidebarItem>
          ))}
        </SidebarSection>
      ))}
      {footer ? <SidebarFooter>{footer}</SidebarFooter> : null}
    </>
  );
}

/**
 * AppShell — cadre applicatif partagé de la suite contentos.
 *
 * Desktop (≥ lg) : sidebar statique à gauche, contenu cadré à droite.
 * Mobile (< lg) : sidebar masquée, une top-bar sticky offre un bouton hamburger
 * qui ouvre la même navigation dans un drawer (base-ui Dialog ancré à gauche) ;
 * cliquer un lien navigue et referme le drawer. Présentationnel : la garde
 * d'auth reste dans le layout serveur, qui passe `homeUrl` et une nav déclarative.
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
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      {/* Sidebar statique — desktop uniquement */}
      <Sidebar className="hidden lg:flex">
        <SidebarNav
          project={project}
          homeUrl={homeUrl}
          sections={sections}
          footer={footer}
          pathname={pathname}
        />
      </Sidebar>

      <div className="flex min-w-0 flex-1 flex-col">
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          {/* Top-bar — mobile uniquement */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-sidebar-border bg-background/80 px-4 backdrop-blur lg:hidden">
            <DialogPrimitive.Trigger
              render={
                <Button variant="ghost" size="icon" aria-label="Ouvrir la navigation" />
              }
            >
              <MenuIcon />
            </DialogPrimitive.Trigger>
            <span className="text-sm">
              <a
                href={homeUrl}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Contentos
              </a>
              <span className="text-muted-foreground"> · </span>
              <span className="font-semibold text-foreground">{project}</span>
            </span>
          </header>

          {/* Drawer — mobile uniquement */}
          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 lg:hidden" />
            <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-left data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-left lg:hidden">
              <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
              <DialogPrimitive.Close
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute top-3 right-3"
                    aria-label="Fermer la navigation"
                  />
                }
              >
                <XIcon />
              </DialogPrimitive.Close>
              <SidebarNav
                project={project}
                homeUrl={homeUrl}
                sections={sections}
                footer={footer}
                pathname={pathname}
                onNavigate={() => setOpen(false)}
              />
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>

        <main className="min-w-0 flex-1 overflow-x-clip">
          <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
