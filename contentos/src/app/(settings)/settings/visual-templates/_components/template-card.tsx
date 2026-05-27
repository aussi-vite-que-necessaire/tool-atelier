'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { TemplateCardData } from './template-card-data';

type Props = {
  card: TemplateCardData;
};

export function TemplateCard({ card }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  // Largeur réelle de la cellule mesurée : l'échelle s'y adapte pour que le
  // template tienne pile dans la vignette sans déborder ni se faire rogner.
  const [boxWidth, setBoxWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setBoxWidth(w);
    });
    ro.observe(el);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => {
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  const scale = boxWidth > 0 ? boxWidth / card.width : 0;

  return (
    <Link
      href={`/settings/visual-templates/${card.id}`}
      className="block rounded-lg border bg-white transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
    >
      {/* Vignette : cellule au ratio du template, iframe mise à l'échelle */}
      <div
        ref={ref}
        className="w-full overflow-hidden rounded-t-lg bg-neutral-50"
        style={{ aspectRatio: `${card.width} / ${card.height}` }}
      >
        {visible && scale > 0 ? (
          <iframe
            title={card.label}
            srcDoc={card.html}
            sandbox=""
            scrolling="no"
            tabIndex={-1}
            style={{
              width: card.width,
              height: card.height,
              border: 0,
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
              pointerEvents: 'none',
            }}
          />
        ) : (
          <div className="h-full w-full animate-pulse bg-neutral-100" />
        )}
      </div>

      {/* Pied de carte */}
      <div className="px-3 py-2">
        <p className="truncate font-medium text-neutral-900">{card.label}</p>
        <p className="truncate text-xs text-neutral-500">
          {card.platform} · {card.slug} · {card.width}×{card.height}
        </p>
      </div>
    </Link>
  );
}
