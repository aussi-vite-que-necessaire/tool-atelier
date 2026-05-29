import type { NavSection } from '@/components/ui/app-shell';

export const castSections: NavSection[] = [
  { links: [
    { href: '/posts', label: 'Posts' },
    { href: '/calendar', label: 'Calendrier' },
  ] },
  { label: 'Réglages', links: [
    { href: '/settings/brand', label: 'Brand' },
    { href: '/settings/voice', label: 'Voix' },
    { href: '/settings/writing-templates', label: "Templates d'écriture" },
    { href: '/settings/connections', label: 'Connexions' },
  ] },
];
