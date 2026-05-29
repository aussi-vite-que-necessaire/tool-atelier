'use client';

import { useEffect, useRef, useState } from 'react';

// Reproduit le « voir plus » du fil LinkedIn : tronqué à 3 lignes, bouton affiché
// seulement si le texte déborde, dépliage en place sans repli.
export function PostText({ content }: { content: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-mesurer le débordement quand le contenu change
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [content]);

  return (
    <div className="text-neutral-900 text-sm leading-snug">
      <p ref={ref} className={`whitespace-pre-wrap ${expanded ? '' : 'line-clamp-3'}`}>
        {content}
      </p>
      {overflowing && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-0.5 font-medium text-neutral-500 hover:text-neutral-700"
        >
          …voir plus
        </button>
      ) : null}
    </div>
  );
}
