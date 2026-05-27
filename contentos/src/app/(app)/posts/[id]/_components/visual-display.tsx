'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { detachMediaAction } from '../media-actions';

type Props = {
  postId: string;
  kind: 'image' | 'carousel' | 'video';
  url: string;
  slideUrls?: string[];
  onReplaceClick: () => void;
};

export function VisualDisplay({ postId, kind, url, slideUrls, onReplaceClick }: Props) {
  const [pending, start] = useTransition();
  const [slide, setSlide] = useState(0);
  const slides = slideUrls ?? [];

  const detach = () => {
    start(async () => {
      const r = await detachMediaAction(postId);
      if (r.status === 'error') toast.error(r.message);
      else toast.success('Visuel détaché');
    });
  };

  return (
    <div className="space-y-2">
      <div className="border rounded p-2 bg-neutral-50 max-w-md">
        {kind === 'video' ? (
          // biome-ignore lint/a11y/useMediaCaption: vidéo utilisateur sans piste
          <video src={url} controls className="w-full h-auto rounded" />
        ) : kind === 'carousel' && slides.length === 0 ? (
          <div className="space-y-2 py-6 text-center">
            <p className="text-sm font-medium">PDF carrousel</p>
            <p className="text-xs text-muted-foreground">
              Document prêt à publier. L'aperçu page par page arrive bientôt.
            </p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm underline"
            >
              Ouvrir le PDF
            </a>
          </div>
        ) : kind === 'carousel' && slides.length > 0 ? (
          <div className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slides[slide]} alt={`Slide ${slide + 1}`} className="w-full h-auto" />
            <div className="flex items-center justify-between text-sm">
              <Button
                variant="ghost"
                size="sm"
                disabled={slide === 0}
                onClick={() => setSlide((s) => Math.max(0, s - 1))}
              >
                ‹
              </Button>
              <span className="text-muted-foreground text-xs">
                {slide + 1} / {slides.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={slide >= slides.length - 1}
                onClick={() => setSlide((s) => Math.min(slides.length - 1, s + 1))}
              >
                ›
              </Button>
            </div>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Visuel du post" className="w-full h-auto" />
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onReplaceClick}>
          Remplacer
        </Button>
        <Button variant="ghost" size="sm" onClick={detach} disabled={pending}>
          {pending ? 'Détachement…' : 'Détacher'}
        </Button>
      </div>
    </div>
  );
}
