'use client';

import { useEffect, useRef, useState } from 'react';

export type TemplatePreview = {
  id: string;
  label: string;
  platform: string;
  width: number;
  height: number;
  html: string;
};

type Props = {
  preview: TemplatePreview;
  onSelect: (id: string) => void;
  onZoom: (preview: TemplatePreview) => void;
};

export function TemplateThumbnail({ preview, onSelect, onZoom }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  // Largeur réelle de la cellule, mesurée : l'échelle s'y adapte pour que le
  // template tienne pile dans la vignette (sinon il déborde et se fait rogner).
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

  const scale = boxWidth > 0 ? boxWidth / preview.width : 0;

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-white">
      <button
        type="button"
        onClick={() => onSelect(preview.id)}
        className="block w-full"
        aria-label={`Choisir ${preview.label}`}
      >
        <div
          ref={ref}
          className="w-full overflow-hidden bg-neutral-50"
          style={{ aspectRatio: `${preview.width} / ${preview.height}` }}
        >
          {visible && scale > 0 ? (
            <iframe
              title={preview.label}
              srcDoc={preview.html}
              sandbox=""
              scrolling="no"
              tabIndex={-1}
              style={{
                width: preview.width,
                height: preview.height,
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
      </button>
      <div className="flex items-center justify-between px-2 py-1 text-xs">
        <span className="truncate font-medium">{preview.label}</span>
        <button
          type="button"
          onClick={() => onZoom(preview)}
          className="ml-1 shrink-0 rounded px-1 text-neutral-500 hover:bg-neutral-100"
          aria-label={`Agrandir ${preview.label}`}
        >
          ⤢
        </button>
      </div>
    </div>
  );
}
