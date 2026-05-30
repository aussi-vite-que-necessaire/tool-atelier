import { ArrowUpRight, CalendarClock, Images, Library, PenLine, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const TOOLS = [
  {
    label: 'Cast',
    icon: PenLine,
    blurb: 'Rédige, illustre, planifie et publie sur LinkedIn — sans quitter ta voix.',
    status: 'Disponible',
    live: true,
    href: '/cast',
  },
  {
    label: 'Media',
    icon: Images,
    blurb: 'Images, carrousels et vidéos générés sous charte, prêts à attacher.',
    status: 'Bientôt',
    live: false,
  },
  {
    label: 'Ressources',
    icon: Library,
    blurb: 'La bibliothèque éditoriale où tes agents puisent idées et références.',
    status: 'Bientôt',
    live: false,
  },
  {
    label: 'Skills',
    icon: Sparkles,
    blurb: 'Les compétences agentiques qui orchestrent toute la chaîne.',
    status: 'Bientôt',
    live: false,
  },
];

const STEPS = [
  { n: '01', icon: Library, title: 'Rassemble', text: 'Idées, sources et briefs au même endroit.' },
  {
    n: '02',
    icon: PenLine,
    title: 'Rédige',
    text: 'Tes agents écrivent dans ta voix, tu gardes la main.',
  },
  {
    n: '03',
    icon: CalendarClock,
    title: 'Publie',
    text: 'Planifie et diffuse, le bon contenu au bon moment.',
  },
];

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="hairline-grid relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_30%_0%,black,transparent)] bg-background/40" />
        <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
          <span className="eyebrow rise-in flex items-center gap-2 text-signal">
            <span className="size-1.5 rounded-full bg-signal" />
            La suite de production de contenu
          </span>
          <h1
            className="rise-in mt-6 max-w-4xl font-display text-6xl leading-[0.92] tracking-tight sm:text-8xl"
            style={{ animationDelay: '80ms' }}
          >
            Du brief à la publication,{' '}
            <span className="italic text-signal">piloté par tes agents.</span>
          </h1>
          <p
            className="rise-in mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground"
            style={{ animationDelay: '160ms' }}
          >
            Contentos réunit les outils dont tes agents IA ont besoin pour produire du contenu de
            bout en bout — en gardant le contrôle éditorial côté humain.
          </p>
          <div
            className="rise-in mt-10 flex flex-wrap items-center gap-3"
            style={{ animationDelay: '240ms' }}
          >
            <Link href="/signin" className={buttonVariants({ variant: 'default', size: 'lg' })}>
              Se connecter
              <ArrowUpRight className="size-4" />
            </Link>
            <Link href="/styleguide" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              Voir le design system
            </Link>
          </div>
        </div>
      </section>

      {/* Les outils */}
      <section className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="eyebrow text-muted-foreground">Les outils</span>
              <h2 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
                Une suite, quatre métiers.
              </h2>
            </div>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
            {TOOLS.map((tool) => {
              const inner = (
                <>
                  <div className="flex items-center justify-between">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-foreground/5 text-foreground ring-1 ring-foreground/10">
                      <tool.icon className="size-5" />
                    </span>
                    <span
                      className={cn(
                        'eyebrow flex items-center gap-1.5',
                        tool.live ? 'text-signal' : 'text-muted-foreground',
                      )}
                    >
                      {tool.live && <span className="size-1.5 rounded-full bg-signal" />}
                      {tool.status}
                    </span>
                  </div>
                  <h3 className="font-display text-2xl tracking-tight">{tool.label}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{tool.blurb}</p>
                  {tool.live && (
                    <ArrowUpRight className="absolute top-8 right-8 size-5 translate-y-1 text-muted-foreground opacity-0 transition-all group-hover:translate-y-0 group-hover:opacity-100" />
                  )}
                </>
              );
              const base = 'group relative flex flex-col gap-4 bg-card p-8 transition-colors';
              return tool.live && tool.href ? (
                <Link key={tool.label} href={tool.href} className={cn(base, 'hover:bg-muted/50')}>
                  {inner}
                </Link>
              ) : (
                <div key={tool.label} className={base}>
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Le flux */}
      <section className="border-t border-border bg-secondary/40">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <span className="eyebrow text-muted-foreground">Le flux</span>
          <h2 className="mt-3 max-w-2xl font-display text-4xl tracking-tight sm:text-5xl">
            Trois temps, un fil continu.
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.n} className="border-t-2 border-foreground/10 pt-5">
                <div className="flex items-center justify-between">
                  <span className="font-display text-3xl text-signal">{step.n}</span>
                  <step.icon className="size-5 text-muted-foreground" />
                </div>
                <h3 className="mt-4 text-lg font-medium">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-5 py-20 sm:px-8">
          <h2 className="max-w-3xl font-display text-4xl leading-tight tracking-tight sm:text-5xl">
            Prêt à laisser tes agents produire — pendant que tu décides ?
          </h2>
          <Link href="/signin" className={buttonVariants({ variant: 'default', size: 'lg' })}>
            Se connecter
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    </>
  );
}
