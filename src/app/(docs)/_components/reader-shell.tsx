import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import type { TocItem } from '@/lib/ressources/toc';
import type { TreePage } from '@/lib/ressources/tree';
import { cn } from '@/lib/utils';
import { PageTree } from './page-tree';
import { Toc } from './toc';

export function ReaderShell({
  brandName,
  handle,
  resourceTitle,
  root,
  basePath,
  currentId,
  toc,
  children,
}: {
  brandName: string;
  handle: string;
  resourceTitle: string;
  root: TreePage;
  basePath: string;
  currentId: string;
  toc: TocItem[];
  children: React.ReactNode;
}) {
  const showTree = root.children.length > 0;
  const showToc = toc.length > 0;
  const gridCols =
    showTree && showToc
      ? 'lg:grid-cols-[240px_1fr_220px]'
      : showTree
        ? 'lg:grid-cols-[240px_1fr]'
        : showToc
          ? 'lg:grid-cols-[1fr_220px]'
          : 'lg:grid-cols-1';

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 h-14 border-b-2 border-[var(--res-ink)] bg-[var(--res-paper)]/90 backdrop-blur">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href={`/docs/${handle}`} className="shrink-0 font-black tracking-tight">
              {brandName}
            </Link>
            <span className="hidden truncate border-l-2 border-[var(--res-ink)]/20 pl-3 font-mono text-xs font-bold uppercase tracking-widest text-[var(--res-ink-soft)] sm:block">
              {resourceTitle}
            </span>
          </div>
          <Link
            href={`/docs/${handle}`}
            className="res-press inline-flex shrink-0 items-center gap-2 border-2 border-[var(--res-ink)] bg-[var(--res-paper)] px-3 py-1.5 text-xs font-bold uppercase tracking-wide shadow-[var(--res-shadow-sm)]"
          >
            <BookOpen className="size-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">Bibliothèque</span>
          </Link>
        </div>
      </header>

      {showTree && (
        <details className="border-b-2 border-[var(--res-ink)] lg:hidden">
          <summary className="cursor-pointer px-4 py-3 font-mono text-xs font-extrabold uppercase tracking-widest sm:px-6">
            Sommaire des pages
          </summary>
          <div className="px-4 pb-4 sm:px-6">
            <PageTree root={root} basePath={basePath} currentId={currentId} />
          </div>
        </details>
      )}

      <div className={`mx-auto grid max-w-6xl grid-cols-1 ${gridCols}`}>
        {showTree && (
          <aside className="hidden self-start border-r-2 border-[var(--res-ink)] p-5 lg:sticky lg:top-14 lg:block lg:max-h-[calc(100vh-3.5rem)] lg:overflow-y-auto">
            <PageTree root={root} basePath={basePath} currentId={currentId} />
          </aside>
        )}
        <main
          className={cn(
            'min-w-0 px-4 py-10 sm:px-8 lg:px-12',
            !showTree && !showToc && 'w-full lg:mx-auto lg:max-w-3xl',
          )}
        >
          {children}
        </main>
        {showToc && (
          <aside className="hidden self-start border-l-2 border-[var(--res-ink)] p-5 lg:sticky lg:top-14 lg:block lg:max-h-[calc(100vh-3.5rem)] lg:overflow-y-auto">
            <Toc items={toc} />
          </aside>
        )}
      </div>

      <footer className="border-t-2 border-[var(--res-ink)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-6 sm:px-6">
          <span className="font-black tracking-tight">{brandName}</span>
          <span className="font-mono text-xs uppercase tracking-widest text-[var(--res-ink-soft)]">
            Contentos · Ressources
          </span>
        </div>
      </footer>
    </div>
  );
}
