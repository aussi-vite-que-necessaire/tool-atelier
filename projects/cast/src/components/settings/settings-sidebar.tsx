'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
} from '@/components/ui/sidebar';

const items: { label: string; href: string }[] = [
  { label: 'Brand', href: '/settings/brand' },
  { label: 'Voix', href: '/settings/voice' },
  { label: "Templates d'écriture", href: '/settings/writing-templates' },
  { label: 'Connexions', href: '/settings/connections' },
];

export function SettingsSidebar() {
  const pathname = usePathname();
  return (
    <Sidebar>
      <SidebarHeader>
        <Link href="/">Contentos</Link>
      </SidebarHeader>
      <SidebarSection label="Réglages">
        {items.map((item) => (
          <SidebarItem
            key={item.href}
            active={pathname?.startsWith(item.href) ?? false}
            render={<Link href={item.href} />}
          >
            {item.label}
          </SidebarItem>
        ))}
      </SidebarSection>
      <SidebarFooter>
        <Link href="/" className="hover:text-foreground">
          ← Retour à l'app
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
