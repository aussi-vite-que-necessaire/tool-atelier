'use client';

import { ImagePlus } from 'lucide-react';
import Link from 'next/link';
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
import type { MediaItem } from '@/lib/media/catalog';
import { attachMediaAction, searchMediaAction } from '../media-picker-actions';

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
};

export function MediaPicker({ postId, open, onOpenChange }: Props) {
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
  // avec un léger débounce pour ne pas spammer la requête à chaque frappe.
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

  const hasMore = items.length < total;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-4xl flex-col sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Choisir un média</DialogTitle>
          <DialogDescription>
            Les médias de ta bibliothèque, du plus récent au plus ancien.
          </DialogDescription>
        </DialogHeader>

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
          <div className="ml-auto">
            <Button variant="secondary" size="sm" render={<Link href="/media/gallery" />}>
              <ImagePlus className="h-4 w-4" />
              Créer un média
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {items.length === 0 && !loading ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-muted-foreground text-sm">Aucun média dans ta bibliothèque.</p>
              <Button variant="outline" size="sm" render={<Link href="/media/gallery" />}>
                <ImagePlus className="h-4 w-4" />
                Aller au studio média
              </Button>
            </div>
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
