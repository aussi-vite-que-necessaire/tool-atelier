/* @generated — synchronisé depuis packages/ui par bin/ui-sync. Ne pas éditer ici : modifier packages/ui puis relancer la synchro. */
import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Typographie partagée — titres et textes.
 *
 * `Heading` rend la balise sémantique correspondant à `level` (h1…h4) avec une
 * échelle visuelle cohérente. Les composants de texte (`Lead`, `Text`, `Muted`,
 * `Code`) couvrent les besoins courants sans imposer de wrapper.
 */

type HeadingLevel = 1 | 2 | 3 | 4;

const headingStyles: Record<HeadingLevel, string> = {
  1: 'font-heading text-3xl leading-tight font-semibold tracking-tight',
  2: 'font-heading text-2xl leading-tight font-semibold tracking-tight',
  3: 'font-heading text-xl leading-snug font-semibold tracking-tight',
  4: 'font-heading text-base leading-snug font-medium',
};

function Heading({
  level = 2,
  className,
  ...props
}: React.ComponentProps<'h2'> & { level?: HeadingLevel }) {
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
  return (
    <Tag data-slot="heading" className={cn(headingStyles[level], className)} {...props} />
  );
}

function Lead({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="lead"
      className={cn('text-lg leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  );
}

function Text({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p data-slot="text" className={cn('text-sm leading-relaxed', className)} {...props} />
  );
}

function Muted({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="muted"
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

function Code({ className, ...props }: React.ComponentProps<'code'>) {
  return (
    <code
      data-slot="code"
      className={cn(
        'rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Heading, Lead, Text, Muted, Code };
