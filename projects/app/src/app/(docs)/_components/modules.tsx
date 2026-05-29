import {
  ArrowUpRight,
  ChevronRight,
  FileDown,
  Info,
  Lightbulb,
  Quote,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { highlightCode } from '@/lib/ressources/highlight';
import type { ParsedModule } from '@/lib/ressources/module-schemas';
import { CopyButton } from './copy-button';
import { Markdown } from './markdown';

// Bordures/ombres/fonds : tokens --res-* (scope docs), en classes arbitraires
// Tailwind pour rester cohérent avec le thème personnalisable de l'opérateur.
const card = 'border-2 border-[var(--res-ink)] shadow-[var(--res-shadow)]';
const cardSm = 'border-2 border-[var(--res-ink)] shadow-[var(--res-shadow-sm)]';

function MarkdownModule({ md }: { md: string }) {
  return <Markdown>{md}</Markdown>;
}

const calloutVariants = {
  info: { label: 'Info', Icon: Info, bg: 'bg-[var(--res-info)]' },
  warn: { label: 'Attention', Icon: TriangleAlert, bg: 'bg-[var(--res-warn)]' },
  success: { label: 'Astuce', Icon: Lightbulb, bg: 'bg-[var(--res-success)]' },
} as const;

function CalloutModule({ variant, md }: { variant: 'info' | 'warn' | 'success'; md: string }) {
  const v = calloutVariants[variant] ?? calloutVariants.info;
  const { Icon } = v;
  return (
    <div className={`my-6 flex gap-3 p-4 ${card} ${v.bg}`}>
      <span className="grid size-8 shrink-0 place-items-center border-2 border-[var(--res-ink)] bg-[var(--res-paper)]">
        <Icon className="size-4" strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 font-mono text-xs font-extrabold uppercase tracking-widest">
          {v.label}
        </div>
        <Markdown>{md}</Markdown>
      </div>
    </div>
  );
}

function ImageModule({ url, alt, caption }: { url: string; alt?: string; caption?: string }) {
  return (
    <figure className="my-6">
      <img src={url} alt={alt ?? ''} className={`w-full ${card}`} />
      {caption && (
        <figcaption className="mt-2 font-mono text-xs uppercase tracking-wide text-[var(--res-ink-soft)]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function VideoModule({ url, caption }: { url: string; caption?: string }) {
  return (
    <figure className="my-6">
      {/* biome-ignore lint/a11y/useMediaCaption: vidéo de ressource sans piste de sous-titres */}
      <video src={url} controls className={`w-full ${card}`} />
      {caption && (
        <figcaption className="mt-2 font-mono text-xs uppercase tracking-wide text-[var(--res-ink-soft)]">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function FileModule({
  url,
  label,
  filename,
  size,
}: {
  url: string;
  label: string;
  filename: string;
  size?: number;
}) {
  const kb = size ? `${Math.round(size / 1024)} Ko` : null;
  return (
    <a
      href={url}
      download
      className={`res-press my-6 flex items-center gap-3 bg-[var(--res-paper)] p-4 no-underline ${card}`}
    >
      <span className="grid size-11 shrink-0 place-items-center border-2 border-[var(--res-ink)] bg-[var(--res-accent)] text-[var(--res-accent-ink)]">
        <FileDown className="size-5" strokeWidth={2.5} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{label}</span>
        <span className="block font-mono text-xs text-[var(--res-ink-soft)]">
          {filename}
          {kb ? ` · ${kb}` : ''}
        </span>
      </span>
      <span className="hidden font-mono text-xs font-bold uppercase tracking-widest text-[var(--res-ink-soft)] sm:block">
        Télécharger
      </span>
    </a>
  );
}

function EmbedModule({ url }: { url: string }) {
  return (
    <div className={`my-6 aspect-video w-full overflow-hidden ${card}`}>
      <iframe
        src={url}
        title="Contenu intégré"
        className="h-full w-full"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation"
      />
    </div>
  );
}

function CodeModule({
  language,
  code,
  filename,
}: {
  language: string;
  code: string;
  filename?: string;
}) {
  const html = highlightCode(code, language);
  return (
    <figure className={`my-6 ${card}`}>
      <figcaption className="flex items-center justify-between gap-2 border-b-2 border-[var(--res-ink)] bg-[var(--res-paper-2)] px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 text-xs">
          <span className="bg-[var(--res-accent)] px-1.5 py-0.5 font-mono font-bold uppercase tracking-wider text-[var(--res-accent-ink)]">
            {language}
          </span>
          {filename && (
            <span className="truncate font-mono text-[var(--res-ink-soft)]">{filename}</span>
          )}
        </span>
        <CopyButton text={code} />
      </figcaption>
      <div className="res-prose overflow-x-auto bg-[var(--res-paper)] p-4 text-sm">
        <pre className="!my-0 !border-0 !shadow-none !p-0">
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: code coloré par Prism côté serveur */}
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      </div>
    </figure>
  );
}

function PromptModule({ prompt, title }: { prompt: string; title?: string }) {
  return (
    <figure className={`my-6 ${card}`}>
      <figcaption className="flex items-center justify-between gap-2 border-b-2 border-[var(--res-ink)] bg-[var(--res-accent)] px-3 py-2 text-[var(--res-accent-ink)]">
        <span className="flex items-center gap-2 font-mono text-xs font-extrabold uppercase tracking-widest">
          <Sparkles className="size-4" strokeWidth={2.5} />
          {title ?? 'Prompt'}
        </span>
        <CopyButton text={prompt} label="Copier le prompt" />
      </figcaption>
      <pre className="overflow-x-auto whitespace-pre-wrap bg-[var(--res-paper)] p-4 font-mono text-sm leading-relaxed">
        {prompt}
      </pre>
    </figure>
  );
}

function AccordionModule({ title, md, open }: { title: string; md: string; open?: boolean }) {
  return (
    <details open={open ?? false} className={`group my-4 bg-[var(--res-paper)] ${card}`}>
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-bold [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="size-4 shrink-0 text-[var(--res-accent)] transition-transform group-open:rotate-90"
          strokeWidth={3}
        />
        {title}
      </summary>
      <div className="border-t-2 border-[var(--res-ink)] px-4 py-3">
        <Markdown>{md}</Markdown>
      </div>
    </details>
  );
}

function StepsModule({ steps }: { steps: { title: string; md: string }[] }) {
  return (
    <ol className="my-6">
      {steps.map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: étapes ordonnées sans id propre
        <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
          {i < steps.length - 1 && (
            <span className="absolute bottom-0 left-[19px] top-11 w-0.5 bg-[var(--res-ink)]" />
          )}
          <span
            className={`z-10 grid size-10 shrink-0 place-items-center bg-[var(--res-accent)] font-mono text-lg font-black text-[var(--res-accent-ink)] ${cardSm}`}
          >
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 pt-1.5">
            <h3 className="text-lg font-bold leading-tight">{s.title}</h3>
            <div className="mt-1">
              <Markdown>{s.md}</Markdown>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function ComparisonModule({ columns }: { columns: { title: string; md: string }[] }) {
  const cols = columns.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2';
  return (
    <div className={`my-6 grid grid-cols-1 gap-4 ${cols}`}>
      {columns.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: colonnes ordonnées sans id propre
        <div key={i} className={`bg-[var(--res-paper)] ${card}`}>
          <h3 className="border-b-2 border-[var(--res-ink)] bg-[var(--res-paper-2)] px-3 py-2 font-mono text-sm font-extrabold uppercase tracking-wide">
            {c.title}
          </h3>
          <div className="px-3 py-2">
            <Markdown>{c.md}</Markdown>
          </div>
        </div>
      ))}
    </div>
  );
}

function QuoteModule({
  text,
  author,
  source,
  url,
}: {
  text: string;
  author?: string;
  source?: string;
  url?: string;
}) {
  return (
    <figure className={`my-8 bg-[var(--res-paper-2)] p-6 ${card}`}>
      <Quote className="size-7 text-[var(--res-accent)]" strokeWidth={2.5} fill="currentColor" />
      <blockquote className="mt-3 text-xl font-medium leading-snug tracking-tight">
        {text}
      </blockquote>
      {(author || source) && (
        <figcaption className="mt-4 font-mono text-xs font-bold uppercase tracking-widest text-[var(--res-ink-soft)]">
          {author}
          {author && source ? ' — ' : ''}
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-[var(--res-accent)] decoration-2 underline-offset-2"
            >
              {source}
            </a>
          ) : (
            source
          )}
        </figcaption>
      )}
    </figure>
  );
}

function CtaModule({
  label,
  url,
  variant,
}: {
  label: string;
  url: string;
  variant?: 'primary' | 'secondary';
}) {
  const primary = variant !== 'secondary';
  return (
    <div className="my-6">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={`res-press inline-flex items-center gap-2 px-5 py-3 font-bold uppercase tracking-wide ${card} ${
          primary
            ? 'bg-[var(--res-accent)] text-[var(--res-accent-ink)]'
            : 'bg-[var(--res-paper)] text-[var(--res-ink)]'
        }`}
      >
        {label}
        <ArrowUpRight className="size-4" strokeWidth={2.5} />
      </a>
    </div>
  );
}

function GalleryModule({ images }: { images: { url: string; alt?: string; caption?: string }[] }) {
  return (
    <div className="my-6 grid grid-cols-2 gap-3 md:grid-cols-3">
      {images.map((img, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: images ordonnées sans id propre
        <figure key={i} className={`group ${cardSm}`}>
          <div className="overflow-hidden">
            <img
              src={img.url}
              alt={img.alt ?? ''}
              className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          {img.caption && (
            <figcaption className="border-t-2 border-[var(--res-ink)] bg-[var(--res-paper)] px-2 py-1 font-mono text-xs text-[var(--res-ink-soft)]">
              {img.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

export function ModuleView({ module }: { module: ParsedModule }) {
  switch (module.type) {
    case 'markdown':
      return <MarkdownModule {...module.content} />;
    case 'callout':
      return <CalloutModule {...module.content} />;
    case 'image':
      return <ImageModule {...module.content} />;
    case 'video':
      return <VideoModule {...module.content} />;
    case 'file':
      return <FileModule {...module.content} />;
    case 'embed':
      return <EmbedModule {...module.content} />;
    case 'code':
      return <CodeModule {...module.content} />;
    case 'prompt':
      return <PromptModule {...module.content} />;
    case 'accordion':
      return <AccordionModule {...module.content} />;
    case 'steps':
      return <StepsModule {...module.content} />;
    case 'comparison':
      return <ComparisonModule {...module.content} />;
    case 'quote':
      return <QuoteModule {...module.content} />;
    case 'cta':
      return <CtaModule {...module.content} />;
    case 'gallery':
      return <GalleryModule {...module.content} />;
  }
}
