'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { ArrowRightIcon, MenuIcon, PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
} from '@/components/ui/sidebar';
import { Code, Heading, Lead, Muted, Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import { ThemeToggle } from './theme-toggle';

const sections = [
  { id: 'fonts', label: 'Fonts' },
  { id: 'couleurs', label: 'Couleurs' },
  { id: 'titres', label: 'Titres' },
  { id: 'boutons', label: 'Boutons' },
  { id: 'formulaires', label: 'Formulaires' },
  { id: 'select', label: 'Select' },
  { id: 'toaster', label: 'Toaster' },
  { id: 'skeleton', label: 'Skeleton' },
  { id: 'modale', label: 'Modale oui/non' },
  { id: 'sidebar', label: 'Sidebar' },
  { id: 'nav-mobile', label: 'Navigation mobile' },
] as const;

const buttonVariants = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const;

const colorTokens: { name: string; cls: string; fg: string }[] = [
  { name: 'background', cls: 'bg-background', fg: 'text-foreground' },
  { name: 'foreground', cls: 'bg-foreground', fg: 'text-background' },
  { name: 'primary', cls: 'bg-primary', fg: 'text-primary-foreground' },
  { name: 'secondary', cls: 'bg-secondary', fg: 'text-secondary-foreground' },
  { name: 'muted', cls: 'bg-muted', fg: 'text-muted-foreground' },
  { name: 'accent', cls: 'bg-accent', fg: 'text-accent-foreground' },
  { name: 'destructive', cls: 'bg-destructive', fg: 'text-white' },
  { name: 'card', cls: 'bg-card', fg: 'text-card-foreground' },
  { name: 'border', cls: 'bg-border', fg: 'text-foreground' },
  { name: 'sidebar', cls: 'bg-sidebar', fg: 'text-sidebar-foreground' },
];

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border pt-10 first:border-t-0 first:pt-0">
      <Heading level={2}>{title}</Heading>
      <Lead className="mt-2 max-w-2xl">{description}</Lead>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Subhead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </p>
  );
}

function FontsSection() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Geist Sans</CardTitle>
          <CardDescription>
            <Code>font-sans</Code> — texte courant et titres (var <Code>--font-heading</Code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="font-sans text-2xl">Crée, planifie et publie — contrôle humain.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span className="font-normal">Regular · 400</span>
            <span className="font-medium">Medium · 500</span>
            <span className="font-semibold">Semibold · 600</span>
            <span className="font-bold">Bold · 700</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Geist Mono</CardTitle>
          <CardDescription>
            <Code>font-mono</Code> — code, identifiants, valeurs techniques.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="font-mono text-lg">bin/ui-sync styleguide → 0.625rem</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Échelle de tailles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-3xl">text-3xl</p>
          <p className="text-2xl">text-2xl</p>
          <p className="text-xl">text-xl</p>
          <p className="text-lg">text-lg</p>
          <p className="text-base">text-base</p>
          <p className="text-sm">text-sm</p>
          <p className="text-xs">text-xs</p>
        </CardContent>
      </Card>
    </div>
  );
}

function ColorsSection() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {colorTokens.map((t) => (
        <div key={t.name} className="space-y-1.5">
          <div className={cn('flex h-16 items-end rounded-lg p-2 ring-1 ring-border', t.cls, t.fg)}>
            <span className="text-xs font-medium">Aa</span>
          </div>
          <div>
            <p className="text-sm font-medium">{t.name}</p>
            <p className="font-mono text-xs text-muted-foreground">{t.cls}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function TitlesSection() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Heading level={1}>Heading level 1</Heading>
        <Heading level={2}>Heading level 2</Heading>
        <Heading level={3}>Heading level 3</Heading>
        <Heading level={4}>Heading level 4</Heading>
      </div>
      <div className="space-y-2 border-t border-border pt-4">
        <Lead>Lead — une accroche un peu plus grande pour introduire une section.</Lead>
        <Text>
          Text — paragraphe courant. La librairie reste volontairement légère : des atomes
          composables plutôt qu'un framework.
        </Text>
        <Muted>Muted — annotation discrète, métadonnée, aide contextuelle.</Muted>
        <Text>
          Inline : <Code>cn()</Code>, <Code>bin/ui-sync cast</Code> et <Code>@contentos/ui</Code>.
        </Text>
      </div>
    </div>
  );
}

function ButtonsSection() {
  return (
    <div className="space-y-6">
      <div>
        <Subhead>Variantes</Subhead>
        <div className="flex flex-wrap items-center gap-2">
          {buttonVariants.map((v) => (
            <Button key={v} variant={v}>
              {v}
            </Button>
          ))}
        </div>
      </div>
      <div>
        <Subhead>Tailles</Subhead>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Ajouter">
            <PlusIcon />
          </Button>
        </div>
      </div>
      <div>
        <Subhead>Avec icône & état</Subhead>
        <div className="flex flex-wrap items-center gap-2">
          <Button>
            <PlusIcon /> Nouveau
          </Button>
          <Button variant="outline">
            Continuer <ArrowRightIcon />
          </Button>
          <Button variant="destructive">
            <Trash2Icon /> Supprimer
          </Button>
          <Button disabled>Désactivé</Button>
        </div>
      </div>
    </div>
  );
}

function FormsSection() {
  return (
    <div className="grid max-w-md gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="sg-name">Nom</Label>
        <Input id="sg-name" placeholder="Jean Dupont" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sg-email">Email</Label>
        <Input id="sg-email" type="email" placeholder="jean@exemple.ch" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sg-msg">Message</Label>
        <Textarea id="sg-msg" rows={3} placeholder="Ton message…" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sg-disabled">Champ désactivé</Label>
        <Input id="sg-disabled" disabled defaultValue="Non éditable" />
      </div>
    </div>
  );
}

function SelectSection() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <div className="max-w-xs space-y-3">
      <div className="space-y-1.5">
        <Label>Plateforme</Label>
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Choisir…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="linkedin">LinkedIn</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="x">X</SelectItem>
            <SelectItem value="threads">Threads</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Muted>
        Valeur : {value ? <Code>{value}</Code> : 'aucune'}. Compatible{' '}
        <Code>{'<form>'}</Code> via <Code>name</Code> + <Code>defaultValue</Code>.
      </Muted>
    </div>
  );
}

function ToasterSection() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={() => toast('Post enregistré')}>
        Défaut
      </Button>
      <Button variant="outline" onClick={() => toast.success('Post publié sur LinkedIn')}>
        Succès
      </Button>
      <Button variant="outline" onClick={() => toast.info('Brouillon sauvegardé automatiquement')}>
        Info
      </Button>
      <Button variant="outline" onClick={() => toast.warning('Quota bientôt atteint')}>
        Avertissement
      </Button>
      <Button variant="outline" onClick={() => toast.error('Échec de la publication')}>
        Erreur
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.promise(new Promise((r) => setTimeout(r, 1500)), {
            loading: 'Publication…',
            success: 'Publié ✓',
            error: 'Échec',
          })
        }
      >
        Promise
      </Button>
    </div>
  );
}

function SkeletonSection() {
  return (
    <div className="max-w-sm space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

function ModalSection() {
  const [last, setLast] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ConfirmDialog
          trigger={<Button variant="outline">Publier le post</Button>}
          title="Publier maintenant ?"
          description="Le post partira immédiatement sur LinkedIn. Tu peux aussi le planifier."
          confirmLabel="Publier"
          onConfirm={() => setLast('Post publié ✓')}
        />
        <ConfirmDialog
          trigger={
            <Button variant="destructive">
              <Trash2Icon /> Supprimer
            </Button>
          }
          variant="destructive"
          title="Supprimer définitivement ?"
          description="Cette action est irréversible."
          confirmLabel="Supprimer"
          onConfirm={() => setLast('Élément supprimé')}
        />
      </div>
      {last ? <Muted>Dernier retour : {last}</Muted> : <Muted>Aucune action pour l'instant.</Muted>}
    </div>
  );
}

function SidebarPreviewSection() {
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-border">
      <Sidebar className="relative h-auto min-h-72 w-full max-w-xs border-r-0">
        <SidebarHeader>Contentos</SidebarHeader>
        <SidebarSection label="Réglages">
          <SidebarItem render={<a href="#sidebar" />} active>
            Brand
          </SidebarItem>
          <SidebarItem render={<a href="#sidebar" />}>Voix</SidebarItem>
          <SidebarItem render={<a href="#sidebar" />}>Templates d'écriture</SidebarItem>
          <SidebarItem render={<a href="#sidebar" />}>Connexions</SidebarItem>
        </SidebarSection>
        <SidebarFooter>← Retour à l'app</SidebarFooter>
      </Sidebar>
    </div>
  );
}

function MobileNavSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-4">
      <Muted>
        Sur mobile, l'AppShell replie la sidebar derrière une top-bar : le bouton hamburger
        ouvre la navigation dans un drawer coulissant. Cliquer un lien referme le drawer. Sur
        desktop (≥ lg) la sidebar reste affichée.
      </Muted>

      {/* Aperçu encadré de la top-bar mobile */}
      <div className="overflow-hidden rounded-xl ring-1 ring-border">
        <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
          <div className="flex h-14 items-center gap-2 border-b border-sidebar-border bg-background/80 px-4 backdrop-blur">
            <DialogPrimitive.Trigger
              render={<Button variant="ghost" size="icon" aria-label="Ouvrir la navigation" />}
            >
              <MenuIcon />
            </DialogPrimitive.Trigger>
            <span className="text-sm">
              <span className="text-muted-foreground">Contentos · </span>
              <span className="font-semibold text-foreground">Cast</span>
            </span>
          </div>
          <div className="bg-background px-4 py-8 text-sm text-muted-foreground">
            Contenu de l'application…
          </div>

          <DialogPrimitive.Portal>
            <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/20 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
            <DialogPrimitive.Popup className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-left data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-left">
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
              <SidebarHeader>
                <span className="block text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Contentos
                </span>
                <span className="mt-1 block text-lg font-semibold text-sidebar-foreground">Cast</span>
              </SidebarHeader>
              <SidebarSection label="Réglages">
                <SidebarItem render={<a href="#nav-mobile" onClick={() => setOpen(false)} />} active>
                  Brand
                </SidebarItem>
                <SidebarItem render={<a href="#nav-mobile" onClick={() => setOpen(false)} />}>
                  Voix
                </SidebarItem>
                <SidebarItem render={<a href="#nav-mobile" onClick={() => setOpen(false)} />}>
                  Connexions
                </SidebarItem>
              </SidebarSection>
              <SidebarFooter>← Retour à l'app</SidebarFooter>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
      </div>
    </div>
  );
}

export function Styleguide() {
  const [active, setActive] = useState<string>(sections[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const first = visible[0];
        if (first) setActive(first.target.id);
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    );
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar className="hidden lg:flex">
        <SidebarHeader>Styleguide</SidebarHeader>
        <SidebarSection label="Composants">
          {sections.map((s) => (
            <SidebarItem key={s.id} render={<a href={`#${s.id}`} />} active={active === s.id}>
              {s.label}
            </SidebarItem>
          ))}
        </SidebarSection>
        <SidebarFooter>contentos · socle cast</SidebarFooter>
      </Sidebar>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="font-heading text-sm font-semibold">@contentos/ui</span>
            <Badge variant="secondary">public</Badge>
          </div>
          <ThemeToggle />
        </header>

        <main className="mx-auto max-w-4xl space-y-12 px-6 py-10">
          <div className="space-y-3">
            <Heading level={1}>Design system</Heading>
            <Lead>
              Composants partagés de la suite contentos — socle <strong>cast</strong>. Source unique :{' '}
              <Code>packages/ui</Code>, copiée dans les projets via <Code>bin/ui-sync</Code>.
            </Lead>
          </div>

          <Section id="fonts" title="Fonts" description="Geist Sans pour le texte et les titres, Geist Mono pour le technique.">
            <FontsSection />
          </Section>
          <Section id="couleurs" title="Couleurs" description="Tokens OKLch, thème clair/sombre. Bascule le thème en haut à droite.">
            <ColorsSection />
          </Section>
          <Section id="titres" title="Titres" description="Échelle typographique : Heading (h1–h4), Lead, Text, Muted, Code.">
            <TitlesSection />
          </Section>
          <Section id="boutons" title="Boutons" description="Variantes, tailles, icônes et états du composant Button.">
            <ButtonsSection />
          </Section>
          <Section id="formulaires" title="Formulaires" description="Champs de saisie : Input, Textarea, Label — états par défaut, focus, désactivé.">
            <FormsSection />
          </Section>
          <Section id="select" title="Select" description="Menu déroulant (base-ui), compatible formulaire — remplace les <select> natifs.">
            <SelectSection />
          </Section>
          <Section id="toaster" title="Toaster" description="Notifications éphémères (sonner), thème-aware. Déclenche via toast() / toast.success(), etc.">
            <ToasterSection />
          </Section>
          <Section id="skeleton" title="Skeleton" description="Placeholder de chargement : compose des blocs pour esquisser le contenu à venir.">
            <SkeletonSection />
          </Section>
          <Section id="modale" title="Modale oui/non" description="ConfirmDialog : confirmation d'action, variante neutre ou destructive.">
            <ModalSection />
          </Section>
          <Section id="sidebar" title="Sidebar" description="Organisme de navigation latérale, composable (header, sections, items, footer).">
            <SidebarPreviewSection />
          </Section>
          <Section
            id="nav-mobile"
            title="Navigation mobile"
            description="Sur petit écran, l'AppShell replie la sidebar derrière une top-bar et un drawer."
          >
            <MobileNavSection />
          </Section>
        </main>
      </div>
    </div>
  );
}
