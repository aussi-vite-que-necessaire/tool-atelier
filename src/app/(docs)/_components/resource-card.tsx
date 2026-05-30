import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export function ResourceCard({
  handle,
  slug,
  title,
  description,
  coverImageUrl,
}: {
  handle: string;
  slug: string;
  title: string;
  description: string | null;
  coverImageUrl: string | null;
}) {
  return (
    <Link
      href={`/docs/${handle}/r/${slug}`}
      className="res-press group flex h-full flex-col border-2 border-[var(--res-ink)] bg-[var(--res-paper)] shadow-[var(--res-shadow)]"
    >
      {coverImageUrl && (
        <div className="aspect-[16/9] overflow-hidden border-b-2 border-[var(--res-ink)]">
          <img
            src={coverImageUrl}
            alt=""
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-xl font-black leading-tight tracking-tight">{title}</h3>
        {description && (
          <p className="mt-2 line-clamp-3 text-sm text-[var(--res-ink-soft)]">{description}</p>
        )}
        <span className="mt-auto inline-flex items-center gap-1 pt-4 font-mono text-xs font-bold uppercase tracking-widest text-[var(--res-accent)]">
          Lire <ArrowRight className="size-3.5" strokeWidth={2.5} />
        </span>
      </div>
    </Link>
  );
}
