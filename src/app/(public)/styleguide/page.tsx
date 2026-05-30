import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Code, Heading, Lead, Muted, Text } from '@/components/ui/typography';

export const metadata = { title: 'Design system — Contentos' };

const TOKENS = [
  { name: 'background', var: 'bg-background' },
  { name: 'foreground', var: 'bg-foreground' },
  { name: 'card', var: 'bg-card' },
  { name: 'primary', var: 'bg-primary' },
  { name: 'secondary', var: 'bg-secondary' },
  { name: 'muted', var: 'bg-muted' },
  { name: 'accent', var: 'bg-accent' },
  { name: 'signal', var: 'bg-signal' },
  { name: 'destructive', var: 'bg-destructive' },
  { name: 'border', var: 'bg-border' },
];

const BUTTON_VARIANTS = [
  'default',
  'outline',
  'secondary',
  'ghost',
  'destructive',
  'link',
] as const;
const BADGE_VARIANTS = ['default', 'secondary', 'outline', 'destructive', 'ghost'] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-border py-14 first:border-t-0">
      <div className="flex items-baseline gap-3">
        <span className="eyebrow text-signal">{id}</span>
        <h2 className="font-display text-3xl tracking-tight">{title}</h2>
      </div>
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function StyleguidePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
      <header className="py-16">
        <span className="eyebrow flex items-center gap-2 text-signal">
          <span className="size-1.5 rounded-full bg-signal" />
          Design system
        </span>
        <h1 className="mt-5 font-display text-6xl leading-[0.95] tracking-tight sm:text-7xl">
          Le langage visuel de Contentos.
        </h1>
        <Lead className="mt-6 max-w-2xl">
          Tokens, typographie et composants — la vitrine vivante du système. Tout ce qui s'affiche
          dans la suite descend d'ici.
        </Lead>
      </header>

      <Section id="01" title="Couleurs">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {TOKENS.map((t) => (
            <div key={t.name} className="flex flex-col gap-2">
              <div className={`h-20 rounded-xl ring-1 ring-foreground/10 ${t.var}`} aria-hidden />
              <div>
                <p className="text-sm font-medium">{t.name}</p>
                <Code className="text-xs">{t.var}</Code>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="02" title="Typographie">
        <div className="space-y-6">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-8">
            <Muted className="eyebrow">Display · Instrument Serif</Muted>
            <p className="font-display text-6xl tracking-tight">Produire, sans bruit.</p>
            <p className="font-display text-4xl italic text-signal">avec emphase</p>
          </div>
          <div className="space-y-4 rounded-2xl border border-border bg-card p-8">
            <Heading level={1}>Titre niveau 1</Heading>
            <Heading level={2}>Titre niveau 2</Heading>
            <Heading level={3}>Titre niveau 3</Heading>
            <Lead>Lead — une accroche posée, en gris, qui introduit la section.</Lead>
            <Text>
              Texte courant. Le corps utilise Geist pour sa neutralité lisible, en contraste avec la
              serif de display. <Code>inline code</Code> pour les détails techniques.
            </Text>
            <Muted>Texte secondaire, discret.</Muted>
            <p className="eyebrow text-muted-foreground">Eyebrow · étiquette monospace</p>
          </div>
        </div>
      </Section>

      <Section id="03" title="Boutons">
        <div className="space-y-8">
          <div className="flex flex-wrap items-center gap-3">
            {BUTTON_VARIANTS.map((v) => (
              <Button key={v} variant={v}>
                {v}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="xs">xs</Button>
            <Button size="sm">sm</Button>
            <Button size="default">default</Button>
            <Button size="lg">lg</Button>
            <Button disabled>désactivé</Button>
          </div>
        </div>
      </Section>

      <Section id="04" title="Badges">
        <div className="flex flex-wrap items-center gap-3">
          {BADGE_VARIANTS.map((v) => (
            <Badge key={v} variant={v}>
              {v}
            </Badge>
          ))}
        </div>
      </Section>

      <Section id="05" title="Champs">
        <div className="grid max-w-xl gap-5">
          <div className="grid gap-2">
            <Label htmlFor="sg-email">Adresse e-mail</Label>
            <Input id="sg-email" type="email" placeholder="toi@exemple.com" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sg-msg">Message</Label>
            <Textarea id="sg-msg" placeholder="Écris quelque chose…" rows={4} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sg-disabled">Champ désactivé</Label>
            <Input id="sg-disabled" disabled placeholder="indisponible" />
          </div>
        </div>
      </Section>

      <Section id="06" title="Cartes">
        <div className="grid gap-5 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Publication planifiée</CardTitle>
              <CardDescription>Partira jeudi à 9h00, sur LinkedIn.</CardDescription>
            </CardHeader>
            <CardContent>
              <Text className="text-muted-foreground">
                Aperçu du contenu, médias attachés et statut de la file.
              </Text>
            </CardContent>
            <CardFooter className="gap-2">
              <Button size="sm">Modifier</Button>
              <Button size="sm" variant="ghost">
                Aperçu
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Chargement</CardTitle>
              <CardDescription>État squelette pendant la récupération.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        </div>
      </Section>
    </div>
  );
}
