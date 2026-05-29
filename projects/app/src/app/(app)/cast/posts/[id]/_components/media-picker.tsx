'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { MediaItem } from '@/lib/media-catalog/client';
import { isMediaCreatedMessage } from '@/lib/media-link/embed';
import {
  attachCreatedMediaAction,
  attachMediaAction,
  searchMediaAction,
} from '../media-picker-actions';

const PAGE = 30;

const KIND_OPTIONS = [
  { value: 'all', label: 'Tous' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Vidéo' },
  { value: 'pdf', label: 'PDF' },
  { value: 'render', label: 'Rendu' },
] as const;

const ORIENTATION_OPTIONS = [
  { value: 'all', label: 'Toutes orientations' },
  { value: 'landscape', label: 'Paysage' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'square', label: 'Carré' },
] as const;

const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

type Props = {
  postId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Embarquement de la page de création de media (iframe). `embedSrc` est l'URL de
  // base (`${MEDIA_ENGINE_URL}/embed/new`), `embedOrigin` l'origine à comparer à
  // `event.origin` des postMessage, `parentOrigin` l'origine de cast transmise à
  // l'iframe (qu'elle valide avant de poster).
  embedSrc: string;
  embedOrigin: string;
  parentOrigin: string;
};

type Mode = 'choisir' | 'creer';

export function MediaPicker({
  postId,
  open,
  onOpenChange,
  embedSrc,
  embedOrigin,
  parentOrigin,
}: Props) {
  const [mode, setMode] = useState<Mode>('choisir');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [orientation, setOrientation] = useState('all');
  const [tag, setTag] = useState('');

  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [attaching, startAttach] = useTransition();

  const fetchPage = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      try {
        const res = await searchMediaAction({
          q: q.trim() || undefined,
          kind: kind === 'all' ? undefined : kind,
          orientation: orientation === 'all' ? undefined : orientation,
          tag: tag.trim() || undefined,
          limit: PAGE,
          offset: nextOffset,
        });
        setTotal(res.total);
        setOffset(res.offset);
        setItems((prev) => (nextOffset === 0 ? res.items : [...prev, ...res.items]));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Recherche impossible');
      } finally {
        setLoading(false);
      }
    },
    [q, kind, orientation, tag],
  );

  // (Re)charge depuis le début à l'ouverture et à chaque changement de filtre,
  // avec un léger débounce pour ne pas spammer le service à chaque frappe.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      void fetchPage(0);
    }, 300);
    return () => clearTimeout(handle);
  }, [open, fetchPage]);

  const select = (item: MediaItem) => {
    startAttach(async () => {
      const r = await attachMediaAction(postId, item.id);
      if (r.status === 'error') {
        toast.error(r.message);
      } else {
        toast.success('Média attaché');
        onOpenChange(false);
      }
    });
  };

  // Mode « Créer » : écoute les postMessage de l'iframe media. On valide l'origine
  // (event.origin === embedOrigin) puis le type ; le payload est revalidé côté
  // serveur par attachCreatedMediaAction avant d'attacher.
  useEffect(() => {
    if (!open || mode !== 'creer') return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== embedOrigin || !isMediaCreatedMessage(e.data)) return;
      const { media } = e.data as { media: unknown };
      startAttach(async () => {
        const r = await attachCreatedMediaAction(postId, media);
        if (r.status === 'error') {
          toast.error(r.message);
        } else {
          toast.success('Média créé et attaché');
          onOpenChange(false);
        }
      });
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [open, mode, embedOrigin, postId, onOpenChange]);

  // Repart sur « Choisir » à chaque réouverture.
  useEffect(() => {
    if (!open) setMode('choisir');
  }, [open]);

  const hasMore = items.length < total;
  const iframeSrc = `${embedSrc}?parentOrigin=${encodeURIComponent(parentOrigin)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{mode === 'choisir' ? 'Choisir un média' : 'Créer un média'}</DialogTitle>
          <DialogDescription>
            {mode === 'choisir'
              ? 'Les médias de la bibliothèque, du plus récent au plus ancien.'
              : 'Upload, génération IA, PDF ou template — attaché au post une fois créé.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1">
          <Button
            type="button"
            variant={mode === 'choisir' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMode('choisir')}
          >
            Choisir
          </Button>
          <Button
            type="button"
            variant={mode === 'creer' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMode('creer')}
          >
            Créer un média
          </Button>
        </div>

        {mode === 'choisir' ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher…"
                className="h-9 w-48"
              />
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className={selectClass}
                aria-label="Type de média"
              >
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
                className={selectClass}
                aria-label="Orientation"
              >
                {ORIENTATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="Tag"
                className="h-9 w-32"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {items.length === 0 && !loading ? (
                <p className="py-10 text-center text-muted-foreground text-sm">Aucun média.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {items.map((item) => (
                    <MediaTile
                      key={item.id}
                      item={item}
                      disabled={attaching}
                      onSelect={() => select(item)}
                    />
                  ))}
                </div>
              )}

              {hasMore && (
                <div className="flex justify-center py-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loading}
                    onClick={() => void fetchPage(offset + PAGE)}
                  >
                    {loading ? 'Chargement…' : 'Charger plus'}
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border">
            <iframe
              src={iframeSrc}
              title="Créer un média"
              className="h-full w-full"
              // Upload de fichiers + scripts (postMessage) nécessaires.
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MediaTile({
  item,
  disabled,
  onSelect,
}: {
  item: MediaItem;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="group relative aspect-square overflow-hidden rounded-lg border bg-neutral-50 outline-none ring-offset-2 transition hover:ring-2 hover:ring-ring focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      {item.kind === 'video' ? (
        // biome-ignore lint/a11y/useMediaCaption: vignette vidéo sans piste
        <video src={item.url} muted className="h-full w-full object-cover" />
      ) : item.kind === 'pdf' ? (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-neutral-500">
          <span className="text-3xl">📄</span>
          <span className="px-2 text-center text-xs">PDF</span>
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt={item.prompt ?? ''} className="h-full w-full object-cover" />
      )}
    </button>
  );
}
