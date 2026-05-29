"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
} from "@/components/ui/sidebar";
import { SignOutButton } from "./sign-out-button";

const navSections: {
  label: string | null;
  links: { href: string; label: string }[];
}[] = [
  { label: null, links: [{ href: "/gallery", label: "Galerie" }] },
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

export function AdminNav({ signOutHref }: { signOutHref: string }) {
  const pathname = usePathname();
  return (
    <Sidebar>
      <SidebarHeader>media</SidebarHeader>
      {navSections.map((section, i) => (
        <SidebarSection key={i} label={section.label ?? undefined}>
          {section.links.map(({ href, label }) => (
            <SidebarItem
              key={href}
              active={pathname?.startsWith(href) ?? false}
              render={<Link href={href} />}
            >
              {label}
            </SidebarItem>
          ))}
        </SidebarSection>
      ))}
      <SidebarFooter>
        <SignOutButton href={signOutHref} />
      </SidebarFooter>
    </Sidebar>
  );
}
