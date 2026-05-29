import { Eye } from 'lucide-react';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Heading } from '@/components/ui/typography';
import { getResource, listAccess } from '@/lib/ressources/service';
import {
  deleteResourceAction,
  grantAccessAction,
  revokeAccessAction,
  updateResourceMetaAction,
} from '../../actions';
import { requireOperator } from '../../authz';
import { PageTreeEditor } from './_components/page-tree-editor';

export const dynamic = 'force-dynamic';

type Node = { id: string; slug: string; title: string; path: string[]; children: Node[] };

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
      {children}
    </h2>
  );
}

const selectClass =
  'rounded-lg border border-border bg-background px-2 py-1 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none';

export default async function ResourceEditor({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const op = await requireOperator();
  let data: Awaited<ReturnType<typeof getResource>>;
  try {
    data = await getResource(op, slug);
  } catch {
    notFound();
  }
  const grantedEmails = data.visibility === 'private' ? await listAccess(op.userId, slug) : [];

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Heading level={1}>{data.title}</Heading>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Badge variant={data.published ? 'default' : 'outline'}>
              {data.published ? 'Publié' : 'Brouillon'}
            </Badge>
            {data.featured && <Badge variant="secondary">★ Featured</Badge>}
            <Badge variant="outline">{data.visibility}</Badge>
          </div>
        </div>
        <a
          href={`/docs/${op.handle}/r/${slug}?preview=1`}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: 'outline' })}
        >
          <Eye className="size-4" strokeWidth={2.5} /> Aperçu
        </a>
      </div>

      <Card className="p-5 sm:p-6">
        <SectionTitle>Métadonnées</SectionTitle>
        <form action={updateResourceMetaAction} className="space-y-4">
          <input type="hidden" name="slug" value={slug} />
          <div className="space-y-1.5">
            <Label>Titre</Label>
            <Input name="title" defaultValue={data.title} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea name="description" defaultValue={data.description ?? ''} rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Image de couverture (URL)</Label>
            <Input
              name="coverImageUrl"
              defaultValue={data.coverImageUrl ?? ''}
              placeholder="https://…"
            />
          </div>
          <div className="flex flex-wrap items-center gap-5 pt-1">
            <label className="flex items-center gap-2 font-medium text-sm">
              Visibilité
              <select name="visibility" defaultValue={data.visibility} className={selectClass}>
                <option value="public">public</option>
                <option value="private">private</option>
              </select>
            </label>
            <label className="flex items-center gap-2 font-medium text-sm">
              <input
                type="checkbox"
                name="published"
                defaultChecked={data.published}
                className="size-4 accent-[var(--primary)]"
              />{' '}
              Publié
            </label>
            <label className="flex items-center gap-2 font-medium text-sm">
              <input
                type="checkbox"
                name="featured"
                defaultChecked={data.featured}
                className="size-4 accent-[var(--primary)]"
              />{' '}
              Featured
            </label>
          </div>
          <Button type="submit">Enregistrer</Button>
        </form>
      </Card>

      {data.visibility === 'private' && (
        <Card className="p-5 sm:p-6">
          <SectionTitle>Accès privé</SectionTitle>
          <ul className="mb-4 space-y-2">
            {grantedEmails.map((e) => (
              <li
                key={e}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <span className="text-sm">{e}</span>
                <form action={revokeAccessAction}>
                  <input type="hidden" name="resourceSlug" value={slug} />
                  <input type="hidden" name="email" value={e} />
                  <Button type="submit" size="sm" variant="ghost" className="text-muted-foreground">
                    Retirer
                  </Button>
                </form>
              </li>
            ))}
            {grantedEmails.length === 0 && (
              <li className="text-muted-foreground text-sm">Aucun accès attribué.</li>
            )}
          </ul>
          <form action={grantAccessAction} className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="resourceSlug" value={slug} />
            <Input
              name="email"
              type="email"
              required
              placeholder="email@client.com"
              className="flex-1"
            />
            <Button type="submit">Autoriser</Button>
          </form>
        </Card>
      )}

      <Card className="p-5 sm:p-6">
        <SectionTitle>Arborescence des pages</SectionTitle>
        <PageTreeEditor root={data.root as Node} resourceSlug={slug} />
      </Card>

      <Card className="border-destructive/30 p-5 sm:p-6">
        <SectionTitle>Zone dangereuse</SectionTitle>
        <form action={deleteResourceAction}>
          <input type="hidden" name="slug" value={slug} />
          <Button type="submit" variant="destructive">
            Supprimer la ressource
          </Button>
        </form>
      </Card>
    </div>
  );
}
