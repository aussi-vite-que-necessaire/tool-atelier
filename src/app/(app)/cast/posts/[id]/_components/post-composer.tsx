'use client';

import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { useLayoutEffect, useRef, useTransition } from 'react';
import { toast } from 'sonner';
import type { LinkedInAuthor } from '@/lib/linkedin/identity';
import type { MediaKind } from '@/lib/media/types';
import { cn } from '@/lib/utils';
import { detachMediaAction } from '../media-picker-actions';

export type MediaInfo = {
  kind: MediaKind;
  url: string;
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

  // Auto-agrandit la textarea pour qu'elle épouse le contenu (pas de scroll interne).
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-mesurer à chaque changement de contenu
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
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

      <div className="px-3 pb-2">
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
      ) : mediaInfo.kind === 'pdf' ? (
        <div className="space-y-1 py-10 text-center">
          <p className="font-medium text-sm">📄 PDF</p>
          <a
            href={mediaInfo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-500 text-xs underline"
          >
            Ouvrir le PDF
          </a>
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
