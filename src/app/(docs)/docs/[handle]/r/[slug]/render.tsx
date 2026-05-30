import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { canAccess } from '@/lib/ressources/access';
import {
  addSubscription,
  getGrantedEmails,
  getPageModules,
  getResourceBySlug,
  recordGateView,
  recordPageView,
  upsertAudienceMember,
} from '@/lib/ressources/queries';
import { resolvePageByPath } from '@/lib/ressources/resolve';
import { getOperatorByHandle } from '@/lib/ressources/settings';
import { extractToc, type TocItem } from '@/lib/ressources/toc';
import {
  isPrefetchRequest,
  parseRefCookie,
  parseRefFromRecord,
  REF_COOKIE,
} from '@/lib/ressources/tracking';
import { buildPageTree, type TreePage } from '@/lib/ressources/tree';
import { ModuleView } from '../../../../_components/modules';
import { ReaderShell } from '../../../../_components/reader-shell';
import { ResourceGate } from '../../../../_components/resource-gate';
import { ThemeStyle } from '../../../../_components/theme-style';
import { getReader } from '../../../../reader';

type NavItem = { id: string; title: string; href: string };

function flattenTree(root: TreePage, basePath: string): NavItem[] {
  const out: NavItem[] = [];
  const walk = (node: TreePage, prefix: string[]) => {
    const href = prefix.length === 0 ? basePath : `${basePath}/${prefix.join('/')}`;
    out.push({ id: node.id, title: node.title, href });
    for (const c of node.children) walk(c, [...prefix, c.slug]);
  };
  walk(root, []);
  return out;
}

export async function renderResourcePage(
  handle: string,
  slug: string,
  path: string[],
  opts?: { preview?: boolean; searchParams?: Record<string, string | string[] | undefined> },
) {
  const operator = await getOperatorByHandle(handle);
  if (!operator) notFound();

  const h = await headers();
  // URL d'abord (présente au 1er clic), cookie en repli (first-touch persisté).
  const ref =
    parseRefFromRecord(opts?.searchParams) ??
    parseRefCookie((await cookies()).get(REF_COOKIE)?.value);
  const reader = await getReader();
  // L'aperçu (brouillons inclus) est réservé au propriétaire de l'espace.
  const isOwner = !!reader && reader.id === operator.userId;
  const preview = !!opts?.preview && isOwner;
  const basePath = `/docs/${handle}/r/${slug}`;
  const backTo = path.length ? `${basePath}/${path.join('/')}` : basePath;

  const data = await getResourceBySlug(operator.userId, slug, preview);
  if (!data) notFound();

  if (!preview) {
    const email = reader?.email ?? null;
    const grantedEmails =
      data.resource.visibility === 'private' ? await getGrantedEmails(data.resource.id) : [];
    if (!canAccess(data.resource, email, grantedEmails)) {
      if (!isPrefetchRequest(h)) await recordGateView(data.resource.id, reader?.id ?? null, ref);
      return (
        <>
          <ThemeStyle theme={operator.theme} />
          <ResourceGate
            handle={handle}
            title={data.resource.title}
            description={data.resource.description}
            coverImageUrl={data.resource.coverImageUrl}
            backTo={backTo}
          />
        </>
      );
    }
    if (reader) {
      await addSubscription(reader.id, data.resource.id, ref);
      if (!isOwner) await upsertAudienceMember(operator.userId, reader.id, ref);
    }
  }

  const root = buildPageTree(data.flatPages);
  if (!root) notFound();
  const page = resolvePageByPath(root, path);
  if (!page) notFound();

  if (!preview && !isPrefetchRequest(h)) {
    await recordPageView(data.resource.id, page.id, reader?.id ?? null, ref);
  }

  const mods = await getPageModules(page.id);
  const toc: TocItem[] = mods
    .filter((m) => m.type === 'markdown' || m.type === 'callout')
    .flatMap((m) => extractToc((m.content as { md: string }).md));

  const flat = flattenTree(root, basePath);
  const idx = flat.findIndex((p) => p.id === page.id);
  const prev = idx > 0 ? flat[idx - 1] : null;
  const next = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  return (
    <>
      <ThemeStyle theme={operator.theme} />
      <ReaderShell
        brandName={operator.brandName ?? operator.name}
        handle={handle}
        resourceTitle={data.resource.title}
        root={root}
        basePath={basePath}
        currentId={page.id}
        toc={toc}
      >
        {preview && (
          <div className="mb-6 flex items-center gap-2 border-2 border-[var(--res-ink)] bg-[var(--res-warn)] px-3 py-2 shadow-[var(--res-shadow-sm)]">
            <span className="border-2 border-[var(--res-ink)] bg-[var(--res-accent)] px-1.5 py-0.5 font-mono text-xs font-bold uppercase text-[var(--res-accent-ink)]">
              Aperçu
            </span>
            <span className="font-mono text-xs font-bold uppercase tracking-wide">
              {data.resource.published ? 'Publiée' : 'Brouillon'} · {data.resource.visibility}
            </span>
          </div>
        )}

        <header className="mb-8">
          <h1 className="res-accent-rule text-4xl font-black tracking-tight sm:text-5xl">
            {page.title}
          </h1>
        </header>

        <div>
          {mods.map((m) => (
            <ModuleView key={m.id} module={m} />
          ))}
        </div>

        {(prev || next) && (
          <nav className="mt-14 grid gap-3 border-t-2 border-[var(--res-ink)] pt-6 sm:grid-cols-2">
            {prev ? (
              <Link
                href={prev.href}
                className="res-press flex flex-col gap-1 border-2 border-[var(--res-ink)] bg-[var(--res-paper)] p-4 shadow-[var(--res-shadow-sm)]"
              >
                <span className="inline-flex items-center gap-1 font-mono text-xs font-bold uppercase tracking-widest text-[var(--res-ink-soft)]">
                  <ArrowLeft className="size-3.5" strokeWidth={2.5} /> Précédent
                </span>
                <span className="font-bold">{prev.title}</span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
            {next ? (
              <Link
                href={next.href}
                className="res-press flex flex-col gap-1 border-2 border-[var(--res-ink)] bg-[var(--res-paper)] p-4 text-right shadow-[var(--res-shadow-sm)]"
              >
                <span className="inline-flex items-center justify-end gap-1 font-mono text-xs font-bold uppercase tracking-widest text-[var(--res-ink-soft)]">
                  Suivant <ArrowRight className="size-3.5" strokeWidth={2.5} />
                </span>
                <span className="font-bold">{next.title}</span>
              </Link>
            ) : (
              <span className="hidden sm:block" />
            )}
          </nav>
        )}
      </ReaderShell>
    </>
  );
}
