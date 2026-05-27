'use client';

import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { useLayoutEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import type { LinkedInAuthor } from '@/lib/linkedin/identity';
import { cn } from '@/lib/utils';
import { detachMediaAction } from '../media-actions';

export type MediaInfo = {
  kind: 'image' | 'carousel' | 'video';
  url: string;
  width: number;
  height: number;
  slideUrls?: string[];
};

type Props = {
  postId: string;
  author: LinkedInAuthor;
  content: string;
  onContentChange: (value: string) => void;
  onContentBlur: () => void;
  saving: boolean;
  mediaInfo: MediaInfo | null;
  onAddVisual: () => void;
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

// Surface d'édition WYSIWYG : le post LinkedIn se rédige directement dans la
// carte. Le repère « ··· voir plus » matérialise le pli du fil (3 lignes) même
// pendant l'édition — c'est là que vit le hook.
export function PostComposer({
  postId,
  author,
  content,
  onContentChange,
  onContentBlur,
  saving,
  mediaInfo,
  onAddVisual,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [foldTop, setFoldTop] = useState<number | null>(null);

  // Auto-agrandit la textarea (pas de scroll interne) et recalcule le pli.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-mesurer à chaque changement de contenu
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;

    const cs = getComputedStyle(ta);
    const lh = Number.parseFloat(cs.lineHeight) || Number.parseFloat(cs.fontSize) * 1.4;
    const pt = Number.parseFloat(cs.paddingTop) || 0;
    const pb = Number.parseFloat(cs.paddingBottom) || 0;
    const textHeight = ta.scrollHeight - pt - pb;
    setFoldTop(textHeight > 3 * lh + 1 ? pt + 3 * lh : null);
  }, [content]);

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="flex items-start gap-2 p-3">
        {author.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={author.avatarUrl}
            alt=""
            className="h-12 w-12 flex-none rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-[#0a66c2] font-semibold text-sm text-white">
            {initials(author.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-neutral-900 text-sm">{author.name}</div>
          {author.headline ? (
            <div className="truncate text-neutral-500 text-xs">{author.headline}</div>
          ) : null}
          <div className="text-neutral-500 text-xs">Maintenant · 🌐</div>
        </div>
      </div>

      <div className="relative px-3 pb-2">
        <textarea
          ref={taRef}
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          onBlur={onContentBlur}
          disabled={saving}
          placeholder="Écris ton post… La première phrase est ton accroche."
          spellCheck
          className="block w-full resize-none whitespace-pre-wrap border-0 bg-transparent p-0 text-neutral-900 text-sm leading-snug outline-none placeholder:text-neutral-400 disabled:opacity-60"
        />
        {foldTop !== null ? (
          <div
            className="pointer-events-none absolute right-3 left-3 flex items-center"
            style={{ top: foldTop }}
            title="Au-delà, LinkedIn masque le texte derrière « voir plus »"
          >
            <span className="flex-1 border-neutral-200 border-t border-dashed" />
            <span className="rounded-full bg-white px-2 py-0.5 font-medium text-[10px] text-neutral-400 uppercase leading-none tracking-wider ring-1 ring-neutral-200">
              ··· voir plus
            </span>
            <span className="flex-1 border-neutral-200 border-t border-dashed" />
          </div>
        ) : null}
      </div>

      <PostVisual postId={postId} mediaInfo={mediaInfo} onAddVisual={onAddVisual} />

      <div className="flex justify-between border-t px-3 py-2 text-neutral-500 text-xs">
        <span>👍❤️👏 128</span>
        <span>14 commentaires · 3 republications</span>
      </div>
      <div className="flex justify-around border-t py-1 font-semibold text-neutral-600 text-sm">
        <span className="px-2 py-1.5">👍 J'aime</span>
        <span className="px-2 py-1.5">💬 Commenter</span>
        <span className="px-2 py-1.5">↪️ Partager</span>
      </div>
    </div>
  );
}

function PostVisual({
  postId,
  mediaInfo,
  onAddVisual,
}: {
  postId: string;
  mediaInfo: MediaInfo | null;
  onAddVisual: () => void;
}) {
  const [detaching, startDetach] = useTransition();
  const [slide, setSlide] = useState(0);

  if (!mediaInfo) {
    return (
      <button
        type="button"
        onClick={onAddVisual}
        className="group flex w-full flex-col items-center justify-center gap-1.5 border-neutral-200 border-y border-dashed bg-neutral-50/60 py-10 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700"
      >
        <ImagePlus className="h-6 w-6 opacity-70 transition group-hover:scale-105" />
        <span className="font-medium text-sm">Ajouter un visuel</span>
        <span className="text-neutral-400 text-xs">Image, carrousel ou vidéo</span>
      </button>
    );
  }

  const slides = mediaInfo.slideUrls ?? [];
  const detach = () => {
    startDetach(async () => {
      const r = await detachMediaAction(postId);
      if (r.status === 'error') toast.error(r.message);
      else toast.success('Visuel détaché');
    });
  };

  return (
    <div className="group relative border-neutral-100 border-y bg-black/[0.02]">
      {mediaInfo.kind === 'video' ? (
        // biome-ignore lint/a11y/useMediaCaption: vidéo utilisateur sans piste
        <video src={mediaInfo.url} controls className="block max-h-[28rem] w-full object-contain" />
      ) : mediaInfo.kind === 'carousel' && slides.length === 0 ? (
        <div className="space-y-1 py-10 text-center">
          <p className="font-medium text-sm">PDF carrousel</p>
          <a
            href={mediaInfo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-500 text-xs underline"
          >
            Ouvrir le PDF
          </a>
        </div>
      ) : mediaInfo.kind === 'carousel' ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slides[slide]}
            alt={`Slide ${slide + 1}`}
            className="block max-h-[28rem] w-full object-contain"
          />
          <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={slide === 0}
              onClick={() => setSlide((s) => Math.max(0, s - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white disabled:opacity-30"
            >
              ‹
            </button>
            <span className="rounded-full bg-black/55 px-2 py-0.5 text-white text-xs">
              {slide + 1} / {slides.length}
            </span>
            <button
              type="button"
              disabled={slide >= slides.length - 1}
              onClick={() => setSlide((s) => Math.min(slides.length - 1, s + 1))}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white disabled:opacity-30"
            >
              ›
            </button>
          </div>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaInfo.url} alt="Visuel du post" className="block w-full" />
      )}

      <div
        className={cn(
          'absolute top-2 right-2 flex gap-1.5 opacity-0 transition group-hover:opacity-100',
          detaching && 'opacity-100',
        )}
      >
        <button
          type="button"
          onClick={onAddVisual}
          className="flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 font-medium text-white text-xs backdrop-blur-sm hover:bg-black/80"
        >
          <RefreshCw className="h-3 w-3" />
          Remplacer
        </button>
        <button
          type="button"
          onClick={detach}
          disabled={detaching}
          className="flex items-center gap-1 rounded-md bg-black/65 px-2 py-1 font-medium text-white text-xs backdrop-blur-sm hover:bg-black/80"
        >
          <Trash2 className="h-3 w-3" />
          {detaching ? 'Détache…' : 'Détacher'}
        </button>
      </div>
    </div>
  );
}
