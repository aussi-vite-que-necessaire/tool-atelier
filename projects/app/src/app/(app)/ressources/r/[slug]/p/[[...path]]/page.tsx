import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Heading } from '@/components/ui/typography';
import { getResource } from '@/lib/ressources/service';
import {
  addModuleAction,
  deleteModuleAction,
  moveModuleAction,
  updateModuleAction,
} from '../../../../actions';
import { requireOperator } from '../../../../authz';
import { ModuleForm } from '../../_components/module-form';

export const dynamic = 'force-dynamic';

type Node = {
  id: string;
  slug: string;
  title: string;
  path: string[];
  modules: { id: string; type: string; position: number; content: Record<string, unknown> }[];
  children: Node[];
};

function findNode(node: Node, path: string[]): Node | null {
  if (path.length === 0) return node;
  const [head, ...rest] = path;
  const child = node.children.find((c) => c.slug === head);
  return child ? findNode(child, rest) : null;
}

function MoveModule({
  slug,
  path,
  id,
  orderedIds,
  dir,
}: {
  slug: string;
  path: string[];
  id: string;
  orderedIds: string;
  dir: 'up' | 'down';
}) {
  return (
    <form action={moveModuleAction}>
      <input type="hidden" name="resourceSlug" value={slug} />
      <input type="hidden" name="path" value={path.join('/')} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="orderedIds" value={orderedIds} />
      <input type="hidden" name="direction" value={dir} />
      <Button
        type="submit"
        size="icon-xs"
        variant="outline"
        aria-label={dir === 'up' ? 'Monter' : 'Descendre'}
      >
        {dir === 'up' ? '↑' : '↓'}
      </Button>
    </form>
  );
}

function DeleteModule({ slug, id }: { slug: string; id: string }) {
  return (
    <form action={deleteModuleAction}>
      <input type="hidden" name="resourceSlug" value={slug} />
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="icon-xs" variant="outline" aria-label="Supprimer le module">
        ✕
      </Button>
    </form>
  );
}

export default async function PageEditor({
  params,
}: {
  params: Promise<{ slug: string; path?: string[] }>;
}) {
  const { slug, path = [] } = await params;
  const op = await requireOperator();
  let data: Awaited<ReturnType<typeof getResource>>;
  try {
    data = await getResource(op, slug);
  } catch {
    notFound();
  }
  const page = findNode(data.root as Node, path);
  if (!page) notFound();

  const orderedIds = page.modules.map((m) => m.id).join(',');

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/ressources/r/${slug}`}
          className="inline-flex items-center gap-1 font-semibold text-muted-foreground text-xs hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2.5} /> {data.title}
        </Link>
        <Heading level={1} className="mt-3">
          {page.title}
        </Heading>
      </div>

      <ul className="space-y-4">
        {page.modules.map((m) => (
          <li key={m.id}>
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Badge>{m.type}</Badge>
                <span className="ml-auto flex gap-1">
                  <MoveModule slug={slug} path={path} id={m.id} orderedIds={orderedIds} dir="up" />
                  <MoveModule
                    slug={slug}
                    path={path}
                    id={m.id}
                    orderedIds={orderedIds}
                    dir="down"
                  />
                  <DeleteModule slug={slug} id={m.id} />
                </span>
              </div>
              <ModuleForm
                action={updateModuleAction}
                resourceSlug={slug}
                path={path}
                module={{ id: m.id, type: m.type, content: m.content }}
              />
            </Card>
          </li>
        ))}
        {page.modules.length === 0 && (
          <li>
            <Card className="border-dashed px-4 py-8 text-center text-muted-foreground text-sm">
              Aucun module sur cette page.
            </Card>
          </li>
        )}
      </ul>

      <Card className="bg-muted p-4 sm:p-5">
        <h2 className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
          Ajouter un module
        </h2>
        <ModuleForm action={addModuleAction} resourceSlug={slug} path={path} />
      </Card>
    </div>
  );
}
