import type { ReactNode } from 'react';

// Écran « bientôt » d'un domaine de la suite encore en chantier. Mise en page
// éditoriale : eyebrow monospace, titre serif, description, et une trame de
// règles fines en fond pour signaler une page en construction sans être vide.
export function ComingSoon({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative mx-auto flex min-h-[60vh] max-w-2xl flex-col items-start justify-center py-16">
      <div className="hairline-grid pointer-events-none absolute inset-0 -z-10 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
      <span className="eyebrow flex items-center gap-2 text-signal">
        <span className="size-1.5 rounded-full bg-signal" />
        {eyebrow}
      </span>
      <h1 className="mt-5 font-display text-5xl leading-[0.95] tracking-tight sm:text-6xl">
        {title}
      </h1>
      <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal/60" />
          <span className="relative inline-flex size-2 rounded-full bg-signal" />
        </span>
        En chantier
      </div>
      {children}
    </section>
  );
}
