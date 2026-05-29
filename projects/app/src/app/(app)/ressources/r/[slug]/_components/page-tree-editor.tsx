import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  addPageAction,
  deletePageAction,
  movePageAction,
  renamePageAction,
} from '../../../actions';

type Node = { id: string; slug: string; title: string; path: string[]; children: Node[] };

function MoveBtn({
  resourceSlug,
  id,
  orderedIds,
  dir,
}: {
  resourceSlug: string;
  id: string;
  orderedIds: string;
  dir: 'up' | 'down';
}) {
  return (
    <form action={movePageAction}>
      <input type="hidden" name="resourceSlug" value={resourceSlug} />
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

function Level({
  nodes,
  resourceSlug,
  parentPath,
}: {
  nodes: Node[];
  resourceSlug: string;
  parentPath: string[];
}) {
  const orderedIds = nodes.map((n) => n.id).join(',');
  return (
    <ul className="space-y-2">
      {nodes.map((node) => (
        <li key={node.id} className="rounded-lg border border-border bg-background p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/ressources/r/${resourceSlug}/p/${node.path.join('/')}`}
              className="font-semibold hover:text-primary hover:underline"
            >
              {node.title}
            </Link>
            <span className="text-muted-foreground text-xs">/{node.path.join('/')}</span>
            <span className="ml-auto flex gap-1">
              <MoveBtn resourceSlug={resourceSlug} id={node.id} orderedIds={orderedIds} dir="up" />
              <MoveBtn
                resourceSlug={resourceSlug}
                id={node.id}
                orderedIds={orderedIds}
                dir="down"
              />
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <form action={renamePageAction} className="flex flex-wrap gap-1">
              <input type="hidden" name="resourceSlug" value={resourceSlug} />
              <input type="hidden" name="path" value={node.path.join('/')} />
              <Input name="title" defaultValue={node.title} className="h-8 w-44" />
              <Input name="slug" defaultValue={node.slug} className="h-8 w-28" />
              <Button type="submit" size="sm" variant="outline">
                Renommer
              </Button>
            </form>
            <form action={deletePageAction}>
              <input type="hidden" name="resourceSlug" value={resourceSlug} />
              <input type="hidden" name="path" value={node.path.join('/')} />
              <Button type="submit" size="sm" variant="ghost" className="text-muted-foreground">
                Supprimer
              </Button>
            </form>
          </div>
          {node.children.length > 0 && (
            <div className="mt-3 ml-3 border-border/40 border-l-2 pl-3">
              <Level nodes={node.children} resourceSlug={resourceSlug} parentPath={node.path} />
            </div>
          )}
        </li>
      ))}
      <li>
        <form
          action={addPageAction}
          className="flex flex-wrap items-center gap-1 rounded-lg border border-border border-dashed p-2"
        >
          <input type="hidden" name="resourceSlug" value={resourceSlug} />
          <input type="hidden" name="parentPath" value={parentPath.join('/')} />
          <Input name="title" placeholder="Titre sous-page" required className="h-8 w-44" />
          <Input name="slug" placeholder="slug" required className="h-8 w-28" />
          <Button type="submit" size="sm" variant="outline">
            <Plus className="size-3.5" strokeWidth={3} /> Sous-page
          </Button>
        </form>
      </li>
    </ul>
  );
}

export function PageTreeEditor({ root, resourceSlug }: { root: Node; resourceSlug: string }) {
  return (
    <div>
      <Link
        href={`/ressources/r/${resourceSlug}/p/`}
        className="inline-block font-semibold hover:text-primary hover:underline"
      >
        {root.title}{' '}
        <span className="font-normal text-muted-foreground text-xs">(page racine)</span>
      </Link>
      <div className="mt-3">
        <Level nodes={root.children} resourceSlug={resourceSlug} parentPath={[]} />
      </div>
    </div>
  );
}
