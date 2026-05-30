'use client';

import { FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { MediaRecord } from '@/lib/media/types';
import { cn } from '@/lib/utils';
import { aggregatePdfAction, deleteMediaAction, editAction } from './actions';

function isRaster(kind: MediaRecord['kind']): boolean {
  return kind === 'image' || kind === 'render';
}

export function GalleryGrid({
  items,
  geminiAvailable,
}: {
  items: MediaRecord[];
  geminiAvailable: boolean;
}) {
  const router = useRouter();
  const [enlarged, setEnlarged] = useState<MediaRecord | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [, startDelete] = useTransition();
  const [building, startBuild] = useTransition();

  const rasterIds = useMemo(() => items.filter((i) => isRaster(i.kind)).map((i) => i.id), [items]);

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-muted-foreground text-sm">
        Aucun média pour l'instant. Génère ou importe ton premier visuel ci-dessus.
      </p>
    );
  }

  function handleDelete(id: string) {
    startDelete(async () => {
      const fd = new FormData();
      fd.set('id', id);
      await deleteMediaAction(fd);
      router.refresh();
      toast.success('Média supprimé');
    });
  }

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function buildPdf() {
    if (selected.length === 0) return;
    startBuild(async () => {
      const r = await aggregatePdfAction(selected);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('PDF assemblé');
      setSelecting(false);
      setSelected([]);
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {selecting ? (
          <>
            <span className="text-muted-foreground text-sm">
              {selected.length} image{selected.length !== 1 ? 's' : ''} sélectionnée
              {selected.length !== 1 ? 's' : ''} (dans l'ordre)
            </span>
            <Button
              size="sm"
              disabled={selected.length === 0 || building}
              onClick={buildPdf}
              className="ml-auto"
            >
              <FileText className="h-4 w-4" />
              {building ? 'Assemblage…' : 'Assembler en PDF'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelecting(false);
                setSelected([]);
              }}
            >
              Annuler
            </Button>
          </>
        ) : (
          rasterIds.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setSelecting(true)}>
              <FileText className="h-4 w-4" />
              Assembler un PDF
            </Button>
          )
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => {
          const pos = selected.indexOf(item.id);
          const selectable = selecting && isRaster(item.kind);
          return (
            <Card key={item.id} size="sm" className="gap-0 overflow-hidden">
              <div
                className={cn(
                  'relative flex h-40 items-center justify-center overflow-hidden bg-muted',
                  selectable && pos >= 0 && 'ring-2 ring-signal ring-inset',
                )}
              >
                {isRaster(item.kind) && (
                  <button
                    type="button"
                    onClick={selecting ? () => toggle(item.id) : () => setEnlarged(item)}
                    className="h-full w-full"
                    title={selecting ? 'Sélectionner' : 'Agrandir'}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.prompt ?? item.kind}
                      className={cn(
                        'h-full w-full object-contain',
                        selecting ? 'cursor-pointer' : 'cursor-zoom-in',
                      )}
                    />
                  </button>
                )}
                {item.kind === 'video' && (
                  // biome-ignore lint/a11y/useMediaCaption: média utilisateur sans piste de sous-titres
                  <video src={item.url} controls className="h-full w-full object-contain" />
                )}
                {item.kind === 'pdf' && (
                  <div className="flex flex-col items-center gap-1 p-2 text-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary text-xs hover:underline"
                    >
                      Ouvrir le PDF
                    </a>
                  </div>
                )}
                {selectable && pos >= 0 && (
                  <span className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-signal font-medium text-signal-foreground text-xs">
                    {pos + 1}
                  </span>
                )}
              </div>

              <CardContent className="flex flex-1 flex-col gap-1 pt-3">
                <div className="space-y-0.5 text-muted-foreground text-xs">
                  <span className="font-medium text-foreground">{item.kind}</span>
                  {item.width && item.height && (
                    <div>
                      {item.width}&times;{item.height}
                    </div>
                  )}
                </div>
                <div className="mt-auto pt-2">
                  <ConfirmDialog
                    trigger={
                      <Button variant="destructive" size="xs">
                        Supprimer
                      </Button>
                    }
                    variant="destructive"
                    title="Supprimer ce média ?"
                    description="Cette action est définitive."
                    confirmLabel="Oui, supprimer"
                    cancelLabel="Non"
                    onConfirm={() => handleDelete(item.id)}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {enlarged && (
        <EnlargeDialog
          item={enlarged}
          geminiAvailable={geminiAvailable}
          onClose={() => {
            setEnlarged(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function EnlargeDialog({
  item,
  geminiAvailable,
  onClose,
}: {
  item: MediaRecord;
  geminiAvailable: boolean;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState({ id: item.id, url: item.url });
  const [state, action, pending] = useActionState(editAction, {});

  useEffect(() => {
    if (state.error) toast.error(state.error);
    if (state.id && state.url) {
      setCurrent({ id: state.id, url: state.url });
      toast.success('Variante créée');
    }
  }, [state]);

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aperçu</DialogTitle>
        </DialogHeader>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt="Média agrandi"
          className="mx-auto max-h-[55vh] max-w-full rounded-lg ring-1 ring-foreground/10"
        />

        {geminiAvailable ? (
          <form action={action} className="space-y-2">
            <input type="hidden" name="sourceId" value={current.id} />
            <Label htmlFor="edit-prompt">Éditer avec l'IA</Label>
            <Textarea
              id="edit-prompt"
              key={current.id}
              name="prompt"
              required
              rows={2}
              placeholder="Décris la modification : ajoute…, change…, retire…"
            />
            <Button type="submit" disabled={pending}>
              {pending ? 'Édition…' : "Éditer avec l'IA"}
            </Button>
          </form>
        ) : (
          <p className="text-muted-foreground text-sm">
            L'édition IA est indisponible dans cet environnement.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
