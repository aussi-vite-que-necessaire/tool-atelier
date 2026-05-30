import Link from 'next/link';
import type { TreePage } from '@/lib/ressources/tree';
import { cn } from '@/lib/utils';

// Sommaire des pages d'une ressource (arbre), avec mise en évidence de la page
// courante. basePath = /docs/<handle>/r/<slug>.
export function PageTree({
  root,
  basePath,
  currentId,
}: {
  root: TreePage;
  basePath: string;
  currentId: string;
}) {
  return (
    <nav aria-label="Sommaire des pages">
      <Item node={root} basePath={basePath} currentId={currentId} prefix={[]} depth={0} />
    </nav>
  );
}

function Item({
  node,
  basePath,
  currentId,
  prefix,
  depth,
}: {
  node: TreePage;
  basePath: string;
  currentId: string;
  prefix: string[];
  depth: number;
}) {
  const href = prefix.length === 0 ? basePath : `${basePath}/${prefix.join('/')}`;
  const isCurrent = node.id === currentId;
  return (
    <div>
      <Link
        href={href}
        aria-current={isCurrent ? 'page' : undefined}
        className={cn(
          'block border-l-2 py-1 pr-2 text-sm transition-colors',
          isCurrent
            ? 'border-[var(--res-accent)] font-bold text-[var(--res-ink)]'
            : 'border-transparent text-[var(--res-ink-soft)] hover:text-[var(--res-ink)]',
        )}
        style={{ paddingLeft: `${depth * 0.75 + 0.6}rem` }}
      >
        {node.title}
      </Link>
      {node.children.map((c) => (
        <Item
          key={c.id}
          node={c}
          basePath={basePath}
          currentId={currentId}
          prefix={[...prefix, c.slug]}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}
