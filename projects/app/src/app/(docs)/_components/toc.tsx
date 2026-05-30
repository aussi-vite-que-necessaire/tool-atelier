import type { TocItem } from '@/lib/ressources/toc';

// Table des matières (ancres h2/h3) de la page courante.
export function Toc({ items }: { items: TocItem[] }) {
  return (
    <nav aria-label="Sur cette page">
      <div className="mb-2 font-mono text-xs font-extrabold uppercase tracking-widest text-[var(--res-ink-soft)]">
        Sur cette page
      </div>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} style={{ paddingLeft: item.depth === 3 ? '0.75rem' : 0 }}>
            <a
              href={`#${item.id}`}
              className="block py-0.5 text-sm text-[var(--res-ink-soft)] hover:text-[var(--res-ink)]"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
