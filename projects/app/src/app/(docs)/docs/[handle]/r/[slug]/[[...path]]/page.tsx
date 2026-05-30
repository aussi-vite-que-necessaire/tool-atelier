import type { Metadata } from 'next';
import { getResourceMeta } from '@/lib/ressources/queries';
import { resourceUrl } from '@/lib/ressources/service';
import { getOperatorByHandle } from '@/lib/ressources/settings';
import { renderResourcePage } from '../render';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string; slug: string }>;
}): Promise<Metadata> {
  const { handle, slug } = await params;
  const op = await getOperatorByHandle(handle);
  if (!op) return { title: 'Ressources' };
  const meta = await getResourceMeta(op.userId, slug);
  if (!meta?.published) return { title: 'Ressources' };
  const description = meta.description ?? undefined;
  const images = meta.coverImageUrl ? [meta.coverImageUrl] : undefined;
  return {
    title: meta.title,
    description,
    openGraph: {
      title: meta.title,
      description,
      url: resourceUrl(handle, slug),
      type: 'article',
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title: meta.title,
      description,
      ...(images ? { images } : {}),
    },
  };
}

export default async function ResourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string; slug: string; path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { handle, slug, path = [] } = await params;
  const sp = await searchParams;
  return renderResourcePage(handle, slug, path, {
    preview: sp.preview === '1',
    searchParams: sp,
  });
}
